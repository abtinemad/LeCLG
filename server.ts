/**
 * server.ts — couche Supabase nettoyée + sécurité
 *
 * La couche Supabase ne tâtonne plus : le schéma réel des tables est connu
 * (TABLE_COLUMNS), les écritures sont filtrées sur les vraies colonnes
 * (cleanPayload), les insertions utilisent un upsert (pas de conflit de clé),
 * et il n'y a plus de conversion personal_id -> user_id ni de cascade de replis.
 *
 * Sécurité conservée : liste blanche des tables, personal_id obligatoire à
 * l'insertion, mises à jour bornées par personal_id, en-tête X-Internal-Secret
 * sur les appels au worker Cloudflare, /api/schema et routes mortes supprimées.
 */

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { aggregateClimate } from "./src/lib/climate";

dotenv.config();

// --- Variables d'environnement obligatoires ---
// On refuse de démarrer si l'une manque, plutôt que de se rabattre en silence
// sur des valeurs de prod codées en dur (ce qui les ferait fuiter dans le
// source et masquerait une mauvaise configuration).
const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
  "GEMINI_API_KEY",
  "CF_WORKER_URL",
  "INTERNAL_SECRET",
  "ADMIN_PASSWORD",
  "ACCESS_PEPPER",
] as const;

const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(
    `[FATAL] Variables d'environnement manquantes : ${missingEnv.join(", ")}. ` +
      `Renseignez-les (voir .env.example) avant de démarrer le serveur.`,
  );
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: "Trop de requêtes, veuillez réessayer plus tard." }
});

// --- Limiteur plus strict : analyses IA coûteuses (Gemini) ---
// Ne s'applique QU'aux analyses (enrich_*/eval_* du worker, et les routes
// dédiées /api/reflection et /api/metacognition). Le chat et l'eval d'étape,
// à fort volume légitime, ainsi que les opérations Supabase, n'y sont PAS
// soumis. Basé sur l'IP : générer de nouvelles clés ne le contourne pas.
const ANALYSIS_TYPES = new Set([
  "enrich_fragments", "enrich_lien", "enrich_affect", "enrich_elan", "enrich_matrice",
  "eval_lien", "eval_affect", "eval_elan", "eval_matrice", "eval_prisme", "eval_lueur", "eval_network",
]);

const costlyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // par IP ; ajustable selon l'usage réel
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  skip: (req) => {
    const t = (req.body && req.body.type) as string | undefined;
    if (t === undefined) return false;   // routes dédiées d'analyse -> limitées
    return !ANALYSIS_TYPES.has(t);        // worker : limité seulement si type d'analyse
  },
  message: { error: "Trop de requêtes d'analyse, patientez quelques minutes." }
});

const PORT = Number(process.env.PORT) || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL as string;

// --- Contrôle d'accès par code à 6 chiffres ---
// ACCESS_PEPPER : secret serveur mêlé au hachage du code. Sans lui, une fuite
// de la table access ne permettrait pas de retrouver les codes par force brute.
const ACCESS_PEPPER = process.env.ACCESS_PEPPER as string;
const CODE_MAX_ATTEMPTS = 5;    // essais ratés tolérés avant blocage
const CODE_LOCK_MINUTES = 15;   // durée du blocage une fois le seuil atteint

// --- Throttle dédié aux tentatives admin -------------------------------
// Le mot de passe admin donne un accès d'export total : sa vérification est
// protégée par un verrou par IP, en mémoire. L'admin étant unique, un reset au
// redémarrage du conteneur est sans conséquence. On ne compte QUE les échecs :
// une session admin légitime (plusieurs requêtes portant le mot de passe)
// n'entame pas le compteur.
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_LOCK_MINUTES = 15;
const adminFailures = new Map<string, { count: number; until: number }>();

function adminLocked(ip: string): boolean {
  const e = adminFailures.get(ip);
  if (!e) return false;
  if (Date.now() > e.until) { adminFailures.delete(ip); return false; }
  return e.count >= ADMIN_MAX_ATTEMPTS;
}
function recordAdminFailure(ip: string): void {
  const now = Date.now();
  const e = adminFailures.get(ip);
  if (!e || now > e.until) {
    adminFailures.set(ip, { count: 1, until: now + ADMIN_LOCK_MINUTES * 60_000 });
  } else {
    e.count += 1;
  }
}
function clearAdminFailures(ip: string): void {
  adminFailures.delete(ip);
}

// Comparaison à temps constant du mot de passe admin : évite de le divulguer
// par le temps de réponse. (Canal marginal en pratique, mais c'est gratuit.)
function isAdminPassword(pw: unknown, expected: string): boolean {
  if (typeof pw !== "string" || !expected) return false;
  const a = Buffer.from(pw);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// --- Schéma réel des tables (source de vérité, aligné sur Supabase) ---
// Toute écriture est filtrée sur ces colonnes : un champ inconnu envoyé par
// le front est ignoré au lieu de faire échouer la requête.
const TABLE_COLUMNS: Record<string, string[]> = {
  sessions:  ["id", "personal_id", "started_at", "ended_at", "step_reached", "validated_steps", "messages", "reflection_card", "status", "user_message_count"],
  cartes:    ["id", "personal_id", "fragment", "deplacement", "deplacement_type", "direction", "direction_type", "texture_relationnelle", "sphere", "emotion", "prisme", "date", "image_url", "user_note", "miroir", "created_at"],
  carnet:    ["id", "personal_id", "plan", "lien_data", "affect_data", "elan_data", "matrice_data", "lueurs", "songes", "serpentin_state", "prismes_unlocked", "last_sync", "created_at"],
  eclats:    ["id", "personal_id", "type", "request_text", "matrice_snapshot", "elan_snapshot", "affect_snapshot", "lien_snapshot", "response_text", "answered_at", "replies", "replies_closed", "created_at"],
  feedbacks: ["id", "personal_id", "message", "response_text", "answered_at", "created_at"],
};

// --- Plafond : nombre maximum de conversations réellement engagées par jour
// et par personal_id. Une session ouverte puis abandonnée aussitôt (ended_at
// vide) ne compte pas. C'est un garde-fou de coût, vérifié côté serveur.
const MAX_CONVERSATIONS_PER_DAY = 3;

// Plafonds de taille des entrées libres de l'utilisateur (Retour/Éclat) : bornés
// côté serveur, le maxLength front étant contournable. La limite globale
// express.json (~100 ko) ne descend pas au champ ; ces garde-fous sont par champ.
const MAX_TEXT_LEN = 4000; // caractères par champ texte libre (request_text, message, réponse)
const MAX_REPLIES = 50;    // réponses cumulées par Éclat

// Ne conserve du payload que les colonnes réellement présentes dans la table.
function cleanPayload(table: string, payload: any): any {
  const cols = TABLE_COLUMNS[table];
  if (!cols || !payload || typeof payload !== "object") return payload;
  const out: any = {};
  for (const key of Object.keys(payload)) {
    if (cols.includes(key)) out[key] = payload[key];
  }
  return out;
}

app.use("/api/", apiLimiter);
// Transcription : l'audio (base64) dépasse la limite ~100 ko d'express.json.
// On élargit la limite POUR CETTE ROUTE UNIQUEMENT, en amont du parseur global
// (qui devient no-op sur ce chemin) ; les autres routes gardent le plafond strict.
app.use("/api/transcribe", express.json({ limit: "8mb" }));
app.use(express.json());

// Limiteur strict sur les routes d'analyse IA — APRÈS express.json() pour
// pouvoir lire req.body.type dans le skip. Le chat et les opérations Supabase
// passent au travers (voir le skip de costlyLimiter).
app.use(["/api/worker", "/api/reflection", "/api/metacognition", "/api/transcribe"], costlyLimiter);

// Request Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Type Definitions
interface ReflectionRequest {
  prompt: string;
}

interface ProxyRequest {
  type: string;
  data?: any;
  messages?: any[];
  max_tokens?: number;
}

// Gemini AI Initialize
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    env: process.env.NODE_ENV
  });
});

// Error Handler Wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Répare les défauts JSON les plus courants des LLM : texte parasite autour
// du JSON, virgules traînantes avant } ou ]. N'est jamais appliquée à un JSON
// déjà valide — la réparation n'est tentée qu'en repli, après un premier échec.
function repairJSON(raw: string): string {
  let s = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  // Ne garde que ce qui est entre le premier { ou [ et le dernier } ou ].
  const candidates = [s.indexOf("{"), s.indexOf("[")].filter((i) => i !== -1);
  const start = candidates.length ? Math.min(...candidates) : -1;
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (start !== -1 && end > start) s = s.slice(start, end + 1);
  // Supprime les virgules traînantes : ,} ou ,] (cause n°1 des parse errors).
  return s.replace(/,(\s*[}\]])/g, "$1");
}

// Distingue une erreur transitoire de l'API Gemini (surcharge 503, quota 429,
// timeout — à retenter) d'une erreur dure (clé invalide, modèle introuvable,
// requête malformée — inutile d'insister, on échoue vite).
function isHardGeminiError(e: any): boolean {
  const m = String(e?.message || e || "").toLowerCase();
  return (
    /\b(400|401|403|404)\b/.test(m) ||
    m.includes("api key") ||
    m.includes("api_key") ||
    m.includes("unauthenticated") ||
    m.includes("permission") ||
    m.includes("invalid_argument") ||
    m.includes("invalid argument") ||
    m.includes("not_found") ||
    m.includes("not found")
  );
}

// Appelle Gemini en attendant un JSON. Deux familles d'échec sont gérées :
//  - l'appel API lui-même échoue : si c'est transitoire (503 « high demand »,
//    429), on attend un court délai croissant et on retente ; si c'est une
//    erreur dure, on échoue immédiatement.
//  - l'appel réussit mais le JSON est malformé : parse direct, puis parse
//    après réparation des coquilles courantes, puis relance.
// Après MAX_ATTEMPTS tentatives infructueuses, une erreur claire est levée —
// jamais un JSON.parse opaque, jamais une exception API brute.
async function geminiJSON(args: any): Promise<any> {
  args.config = {
    maxOutputTokens: 8192,                  // défaut large ; surchargeable par un caller
    ...(args.config || {}),
    responseMimeType: "application/json",    // toujours imposé
    // Tâches d'extraction JSON : aucun raisonnement interne n'est nécessaire.
    // Sur les modèles « flash » récents, le « thinking » est actif par défaut
    // et ses tokens sont décomptés de maxOutputTokens — il dévore le budget,
    // et le JSON ressort tronqué (« Unterminated string », « Unexpected end
    // of JSON input »). On le désactive : tout le budget va au JSON renvoyé.
    thinkingConfig: { thinkingBudget: 0 },
  };
  const MAX_ATTEMPTS = 4;
  let lastErr: any;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // --- Appel Gemini ---
    let result: any;
    try {
      result = await ai.models.generateContent(args);
    } catch (e: any) {
      lastErr = e;
      // Erreur dure (clé, modèle, requête) : inutile de retenter.
      if (isHardGeminiError(e)) throw e;
      // Erreur transitoire (surcharge, quota, timeout) : court délai
      // croissant (1 s, 2 s), puis nouvelle tentative.
      console.warn(
        `geminiJSON: appel Gemini en échec transitoire (tentative ${attempt}/${MAX_ATTEMPTS}): ${e?.message}`,
      );
      if (attempt < MAX_ATTEMPTS) {
        // Backoff exponentiel + jitter : un pic de surcharge 503 a besoin de
        // temps pour retomber ; 1s/2s ne suffit pas. ~2s, 4s, 8s.
        const base = Math.min(2000 * 2 ** (attempt - 1), 8000);
        await new Promise((r) => setTimeout(r, base + Math.floor(Math.random() * 500)));
      }
      continue;
    }
    // Diagnostic : si Gemini coupe sur la limite de tokens, le JSON sera
    // forcément incomplet — on le signale explicitement, plutôt que de laisser
    // un « Unterminated string » opaque surgir plus bas au parse.
    if (result?.candidates?.[0]?.finishReason === "MAX_TOKENS") {
      console.warn(
        `geminiJSON: réponse tronquée par la limite de tokens ` +
          `(tentative ${attempt}/${MAX_ATTEMPTS}) — augmenter maxOutputTokens pour ce caller.`,
      );
    }
    // --- Parse du JSON renvoyé ---
    const text = (result.text || "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    // 1) tentative directe — un JSON déjà valide n'est jamais altéré.
    try {
      return JSON.parse(text);
    } catch (e: any) {
      lastErr = e;
    }
    // 2) repli — on répare les coquilles LLM courantes puis on re-tente.
    try {
      return JSON.parse(repairJSON(text));
    } catch (e: any) {
      lastErr = e;
      console.warn(
        `geminiJSON: réponse non-JSON (tentative ${attempt}/${MAX_ATTEMPTS}): ${e.message}\n` +
          `--- brut (200 c.) ---\n${text.slice(0, 200)}`,
      );
      // JSON malformé : on retente l'appel entier au tour suivant (sans
      // délai — ce n'est pas une surcharge).
    }
  }
  throw new Error(
    `Gemini a échoué après ${MAX_ATTEMPTS} tentatives: ${lastErr?.message}`,
  );
}

// Transcription audio via Gemini (multimodal). Frère de geminiJSON, mais SANS
// sortie JSON forcée : texte brut. L'audio (base64) n'est jamais persisté ni loggé.
async function geminiTranscribe(mimeType: string, base64Audio: string): Promise<string> {
  const MAX_ATTEMPTS = 3;
  let lastErr: any;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: base64Audio } },
              {
                text:
                  "Tu es un moteur de transcription. Transcris fidèlement, mot pour mot, " +
                  "le contenu parlé de cet audio (en français). Ne réponds RIEN d'autre que " +
                  "la transcription : aucun commentaire, aucune interprétation, aucune réponse, " +
                  "aucune étiquette du type « Transcription : ». Si l'audio est vide ou inaudible, " +
                  "renvoie une chaîne vide.",
              },
            ],
          },
        ],
        config: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 2048 },
      });
      return (result.text || "").trim();
    } catch (e: any) {
      lastErr = e;
      if (isHardGeminiError(e)) throw e;
      console.warn(`geminiTranscribe: échec transitoire (${attempt}/${MAX_ATTEMPTS}): ${e?.message}`);
      if (attempt < MAX_ATTEMPTS) {
        const base = Math.min(2000 * 2 ** (attempt - 1), 8000);
        await new Promise((r) => setTimeout(r, base + Math.floor(Math.random() * 500)));
      }
    }
  }
  throw new Error(`Gemini (transcription) a échoué après ${MAX_ATTEMPTS} tentatives: ${lastErr?.message}`);
}

// Supabase Helper
async function sbRequest(method: string, tablePath: string, body: any, serviceKey: string, upsert: boolean = false) {
  const prefer: string[] = [];
  if (method === "POST") prefer.push("return=representation");
  else if (method === "PATCH" || method === "DELETE") prefer.push("return=minimal");
  if (upsert) prefer.push("resolution=merge-duplicates");

  const headers: any = {
    "Content-Type": "application/json",
    "apikey": serviceKey,
    "Authorization": `Bearer ${serviceKey}`,
  };
  if (prefer.length) headers["Prefer"] = prefer.join(",");

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tablePath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const errText = await res.text();
    let errData: any;
    try {
      errData = JSON.parse(errText);
    } catch (e) {
      errData = { message: errText };
    }
    // Ne jamais logger le personal_id en clair (c'est le secret porteur du
    // chemin data) : on le caviarde dans tout ce qui part en logs ou en erreur.
    const safePath = tablePath.replace(
      /personal_id=eq\.[^&\s)]*/g,
      "personal_id=eq.[redacted]",
    );
    if (res.status === 401) {
      console.error(`Supabase Unauthorized (${method} ${safePath}). Check SUPABASE_SERVICE_KEY.`);
    } else {
      console.error(`Supabase Error (${method} ${safePath}):`, errData);
    }
    throw new Error(`Supabase ${method} ${safePath} failed (${res.status}): ${JSON.stringify(errData)}`);
  }

  if (method === "POST" || method === "PATCH" || method === "GET") {
    try {
      const data = await res.json();
      return Array.isArray(data) ? data : [data];
    } catch (e) {
      return null;
    }
  }
  return null;
}

// ── Contrôle d'accès : hachage du code + vérification avec verrou ──

// HMAC(personal_id + code, ACCESS_PEPPER) — le code n'est jamais stocké en clair.
function hashCode(personalId: string, code: string): string {
  return crypto
    .createHmac("sha256", ACCESS_PEPPER)
    .update(`${personalId}:${code}`)
    .digest("hex");
}

// Comparaison à temps constant de deux hashs hex.
function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Vérifie le couple (personal_id, code) contre la table access, en gérant le
// verrou anti-brute-force. Statuts : 200 ok, 400 entrée invalide,
// 401 inconnu/faux, 423 verrouillé temporairement.
async function verifyAccess(
  personalId: string,
  code: string,
  serviceKey: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!personalId) return { ok: false, status: 400, error: "invalid" };
  const rows = await sbRequest(
    "GET",
    `access?personal_id=eq.${encodeURIComponent(personalId)}&select=*`,
    null,
    serviceKey,
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  // Pas de compte réclamé pour cette clé : on le signale distinctement
  // ("unknown") AVANT toute exigence sur le code — l'appelant décide quoi en
  // faire (la lecture l'autorise, la connexion la refuse).
  if (!row) return { ok: false, status: 401, error: "unknown" };
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return { ok: false, status: 400, error: "invalid" };
  }

  // Verrou encore actif ?
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return { ok: false, status: 423, error: "locked" };
  }

  if (safeEqualHex(hashCode(personalId, code), row.code_hash)) {
    // Succès : on remet le compteur à zéro si nécessaire.
    if ((row.failed_attempts || 0) > 0 || row.locked_until) {
      await sbRequest(
        "PATCH",
        `access?personal_id=eq.${encodeURIComponent(personalId)}`,
        { failed_attempts: 0, locked_until: null },
        serviceKey,
      );
    }
    return { ok: true, status: 200 };
  }

  // Échec : on incrémente, et on pose le verrou au seuil.
  const attempts = (row.failed_attempts || 0) + 1;
  const patch: any = { failed_attempts: attempts };
  if (attempts >= CODE_MAX_ATTEMPTS) {
    patch.locked_until = new Date(
      Date.now() + CODE_LOCK_MINUTES * 60 * 1000,
    ).toISOString();
    patch.failed_attempts = 0; // repart à zéro une fois le verrou posé
  }
  await sbRequest(
    "PATCH",
    `access?personal_id=eq.${encodeURIComponent(personalId)}`,
    patch,
    serviceKey,
  );
  return { ok: false, status: 401, error: "wrong" };
}

// ── Chiffrement au repos des champs sensibles (niveau 2A) ──────────
// AES-256-GCM. La clé dérive du ACCESS_PEPPER (serveur, jamais en base) via
// HKDF — une seule clé, pas de sel par utilisateur : ça suffit puisque le
// pepper est l'unique secret, et ça évite tout risque de clé qui ne correspond
// pas lors des mises à jour. Une fuite de base sans le pepper ne donne que du
// chiffré. Le serveur peut déchiffrer (l'opérateur n'est donc PAS aveugle —
// ce niveau protège contre une fuite de base, pas contre l'opérateur).
const ENC_PREFIX = "enc:v1:";
const FIELD_KEY = Buffer.from(
  crypto.hkdfSync(
    "sha256",
    Buffer.from(ACCESS_PEPPER),
    Buffer.from("lecollegue-enc-salt"),
    Buffer.from("field-enc-v1"),
    32,
  ),
);

// Champs sensibles chiffrés au repos, par table.
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  cartes:    ["fragment", "deplacement", "direction", "user_note", "texture_relationnelle", "miroir"],
  carnet:    ["lien_data", "affect_data", "elan_data", "matrice_data", "lueurs", "songes"],
  eclats:    ["request_text", "matrice_snapshot", "elan_snapshot", "affect_snapshot", "lien_snapshot", "response_text", "replies"],
  sessions:  ["reflection_card"],
  feedbacks: ["message", "response_text"],
};

// Chiffre n'importe quelle valeur (texte ou objet) en une chaîne enc:v1:...
function encField(value: any): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", FIELD_KEY, iv);
  const pt = Buffer.from(JSON.stringify(value), "utf8");
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    ENC_PREFIX +
    iv.toString("base64") + ":" + ct.toString("base64") + ":" + tag.toString("base64")
  );
}

// Déchiffre une valeur enc:v1:... ; renvoie tel quel si non chiffrée (legacy).
function decField(stored: any): any {
  if (typeof stored !== "string" || !stored.startsWith(ENC_PREFIX)) return stored;
  try {
    const [ivB, ctB, tagB] = stored.slice(ENC_PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      FIELD_KEY,
      Buffer.from(ivB, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(ctB, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(pt.toString("utf8"));
  } catch (e: any) {
    console.error("decField failed:", e?.message);
    return null; // jamais renvoyer le chiffré brut
  }
}

// Chiffre les champs sensibles d'un payload avant écriture.
function encryptRow(table: string, payload: any): any {
  const fields = ENCRYPTED_FIELDS[table];
  if (!fields || !payload || typeof payload !== "object") return payload;
  const out = { ...payload };
  for (const f of fields) {
    if (out[f] !== undefined && out[f] !== null) out[f] = encField(out[f]);
  }
  return out;
}

// Déchiffre les champs sensibles d'une ligne lue.
function decryptRow(table: string, row: any): any {
  const fields = ENCRYPTED_FIELDS[table];
  if (!fields || !row || typeof row !== "object") return row;
  for (const f of fields) {
    if (row[f] !== undefined && row[f] !== null) row[f] = decField(row[f]);
  }
  return row;
}

app.post("/api/reflection", asyncHandler(async (req: Request, res: Response) => {
  const { prompt }: ReflectionRequest = req.body;

  const parsed = await geminiJSON({
    model: "gemini-3.5-flash",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 2048 }
  });

  res.json({ text: JSON.stringify(parsed) });
}));


// ── Validation stricte des paramètres de lecture (sb_read) ─────────
// La connexion Supabase utilise la Service-Key (RLS contournée) : la seule
// barrière est la query que le serveur construit. On n'autorise donc QUE des
// clauses connues — filtres sur colonnes réelles, `order`, `limit` — et on
// rejette tout ce qui pourrait élargir la requête : embeds `select=...(...)`,
// `or=(...)`, listes `in.(...)`. Ce vocabulaire couvre exactement les
// lectures légitimes du client (cf. sbGet).
function validateReadParams(table: string, params: string): boolean {
  if (!params) return true; // lecture pleine table : réservée à l'admin, déjà gardée par mot de passe
  const cols = TABLE_COLUMNS[table] || [];
  for (const clause of params.split("&")) {
    if (!clause) continue;
    if (/[(),]/.test(clause)) return false; // ni parenthèses ni virgules : ferme embeds / or / in.()
    const eq = clause.indexOf("=");
    if (eq < 0) return false;
    const key = clause.slice(0, eq);
    const val = clause.slice(eq + 1);
    if (key === "order") {
      const m = val.match(/^([a-z_]+)\.(asc|desc)$/);
      if (!m || !cols.includes(m[1])) return false;
    } else if (key === "limit") {
      if (!/^\d+$/.test(val) || Number(val) > 1000) return false;
    } else {
      if (!cols.includes(key)) return false; // filtre uniquement sur une vraie colonne
      const okOp = /^(eq|neq|gte|gt|lte|lt)\.[^(),]*$/.test(val)
        || val === "is.null" || val === "not.is.null";
      if (!okOp) return false;
    }
  }
  return true;
}


// Supabase Proxy Routes (Compatibility with worker logic)
app.post("/api/worker", asyncHandler(async (req: Request, res: Response) => {
  const { type, data, messages, max_tokens }: ProxyRequest = req.body;
  // Plafond coût : on borne max_tokens quoi que le client demande (l'app
  // utilise 1000 ; 2048 laisse de la marge sans permettre d'abus).
  const safeMaxTokens = Math.min(
    typeof max_tokens === "number" && max_tokens > 0 ? max_tokens : 1000,
    2048,
  );
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || "";
  const adminPassword = process.env.ADMIN_PASSWORD || "";

  if (!serviceKey) throw new Error("SUPABASE_SERVICE_KEY is missing");

  // Throttle dédié : toute requête portant un mot de passe est une tentative
  // admin. On bloque l'IP après trop d'échecs ; seul un mot de passe erroné
  // entame le compteur (une session admin valide ne le touche pas).
  if (typeof data?.password === "string" && data.password.length > 0) {
    const ip = req.ip || "unknown";
    if (adminLocked(ip)) {
      return res.status(429).json({ error: "Trop de tentatives, réessayez plus tard." });
    }
    if (isAdminPassword(data.password, adminPassword)) {
      clearAdminFailures(ip);
    } else {
      recordAdminFailure(ip);
    }
  }

  // Extract personal_id from payload or params to forward it to Supabase as header
  const personalId =
    (data?.payload && data.payload.personal_id) ||
    (data?.params && (data.params.match(/personal_id=eq\.([^&]+)/) || [])[1]);

  // --- Sécurité : seules les tables connues sont accessibles ---
  if (type === "sb_insert" || type === "sb_update" || type === "sb_read") {
    if (!data || !TABLE_COLUMNS[data.table]) {
      return res.status(400).json({ error: "Table non autorisée" });
    }
  }

  // --- Sécurité : une INSERTION sur une table utilisateur doit porter un personal_id ---
  if (type === "sb_insert") {
    const pid = data.payload && data.payload.personal_id;
    if (!pid && data.table !== "feedbacks") {
      return res.status(400).json({ error: "personal_id requis" });
    }
  }

  // --- Sécurité : ÉCRITURE → code exigé (clé réclamée ou non) ---------------
  // Avec le code obligatoire dès l'onboarding (3b), tout client légitime a un
  // compte avant d'écrire la moindre donnée — account_create crée la ligne
  // `access` en amont (et passe par un autre handler, pas par ce gate). Une
  // écriture sur une clé SANS compte ("unknown") ne peut donc venir que d'un
  // contournement du client : on la refuse aussi, fermant le déchet orphelin.
  // `feedbacks` (sans personal_id) et l'admin (mot de passe) → non concernés.
  if (
    (type === "sb_insert" || type === "sb_update") &&
    personalId &&
    !isAdminPassword(data.password, adminPassword)
  ) {
    const v = await verifyAccess(personalId, data.code || "", serviceKey);
    if (!v.ok) {
      const status = v.error === "unknown" ? 401 : v.status;
      return res.status(status).json({ error: v.error });
    }
  }

  // --- Sécurité : les champs de réponse (response_text / answered_at, plus
  // replies / replies_closed pour les eclats) sont en écriture contrôlée —
  // jamais via le chemin d'insertion (la demande d'Éclat ou le retour envoyé
  // par la personne). Sinon une insertion forgée déposerait un faux Éclat ou
  // un faux retour déjà « répondu » / pré-clôturé. La réponse passe par
  // sb_update (admin) ; les réponses de la personne à un Éclat par le handler
  // eclat_reply ; la clôture par sb_update (admin).
  if (type === "sb_insert" && data.payload) {
    if (data.table === "eclats" || data.table === "feedbacks") {
      delete data.payload.response_text;
      delete data.payload.answered_at;
    }
    if (data.table === "eclats") {
      delete data.payload.replies;
      delete data.payload.replies_closed;
    }
    // Plafond par champ sur le free-text utilisateur (le maxLength front est
    // contournable) : borne l'abus de stockage et les payloads démesurés.
    if (
      data.table === "eclats" &&
      typeof data.payload.request_text === "string" &&
      data.payload.request_text.length > MAX_TEXT_LEN
    ) {
      return res.status(400).json({ error: "request_text trop long" });
    }
    if (
      data.table === "feedbacks" &&
      typeof data.payload.message === "string" &&
      data.payload.message.length > MAX_TEXT_LEN
    ) {
      return res.status(400).json({ error: "message trop long" });
    }
  }

  if (type === "sb_insert") {
    // --- Plafond : limite de conversations par jour (table sessions) ---
    // On compte les sessions du jour réellement engagées (ended_at renseigné,
    // ce qui exclut les sessions ouvertes puis abandonnées aussitôt).
    if (data.table === "sessions") {
      const pid = data.payload && data.payload.personal_id;
      if (pid) {
        try {
          const dayStart = new Date();
          dayStart.setUTCHours(0, 0, 0, 0);
          const todays = await sbRequest(
            "GET",
            `sessions?personal_id=eq.${encodeURIComponent(pid)}` +
              `&started_at=gte.${dayStart.toISOString()}` +
              `&ended_at=not.is.null&select=id`,
            null,
            serviceKey,
          );
          const count = Array.isArray(todays) ? todays.length : 0;
          if (count >= MAX_CONVERSATIONS_PER_DAY) {
            return res.status(429).json({
              error: "daily_limit",
              count,
              limit: MAX_CONVERSATIONS_PER_DAY,
            });
          }
        } catch (e: any) {
          // Fail-open : si le comptage échoue, on ne bloque pas la personne.
          console.error("daily limit check failed:", e?.message);
        }
      }
    }

    // Le payload est filtré sur les vraies colonnes ; un champ inconnu est ignoré.
    // upsert : si une ligne avec le même id existe déjà, elle est mise à jour
    // au lieu de provoquer un conflit de clé primaire.
    const payload = encryptRow(data.table, cleanPayload(data.table, data.payload));
    const row = await sbRequest("POST", data.table, payload, serviceKey, true);
    return res.json({ row: row && row[0] ? decryptRow(data.table, row[0]) : null });
  }

  if (type === "sb_update") {
    // Les tables eclats et feedbacks portent la réponse de l'admin : la
    // déposer est un acte d'admin. Le filtre ?id=eq.X n'est borné par aucun
    // personal_id (la ligne appartient à la personne, pas à l'admin) — sans
    // ce contrôle, quiconque connaît un id pourrait injecter une réponse. On
    // exige donc le mot de passe admin pour toute mise à jour de ces tables.
    if (
      (data.table === "eclats" || data.table === "feedbacks") &&
      !isAdminPassword(data.password, adminPassword)
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    // Toute autre mise à jour doit être scopée à un personal_id. Sans lui, le
    // filtre retomberait sur id seul → quiconque connaît un id pourrait écraser
    // la ligne d'un autre. Miroir du garde-fou de lecture (sb_read).
    if (!personalId && !isAdminPassword(data.password, adminPassword)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    // La mise à jour est bornée à l'id, et au personal_id appelant (le repli
    // id seul n'est désormais possible que pour l'admin) : on ne peut pas
    // écraser la ligne d'un autre utilisateur.
    const payload = encryptRow(data.table, cleanPayload(data.table, data.payload));
    const filter = personalId
      ? `${data.table}?id=eq.${encodeURIComponent(data.id)}&personal_id=eq.${encodeURIComponent(personalId)}`
      : `${data.table}?id=eq.${encodeURIComponent(data.id)}`;
    await sbRequest("PATCH", filter, payload, serviceKey);
    return res.json({ ok: true });
  }

  if (type === "sb_read") {
    const queryParams = data.params || "";
    const hasUserFilter = queryParams.includes("personal_id=eq.");
    const isAdmin = isAdminPassword(data.password, adminPassword);
    if (!isAdmin && !hasUserFilter) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!validateReadParams(data.table, queryParams)) {
      return res.status(400).json({ error: "Paramètres de lecture invalides" });
    }

    // Lecture utilisateur : si la clé a un compte (ligne access), le code est
    // exigé et vérifié (avec verrou anti-brute-force). Si la clé n'a PAS de
    // compte ("unknown"), on ne sert RIEN depuis le cloud : un nouvel
    // utilisateur n'a rien à relire, et une clé devinée sans compte ne doit
    // plus exposer de données. L'usage mono-appareil reste intact (le Carnet
    // lit d'abord en localStorage) ; seule la synchro cross-device exige
    // désormais un code — ce qui est précisément le cas qu'on protège.
    if (!isAdmin && hasUserFilter) {
      const v = await verifyAccess(personalId, data.code || "", serviceKey);
      if (!v.ok) {
        if (v.error === "unknown") return res.json([]);
        return res.status(v.status).json({ error: v.error });
      }
    }

    const params = queryParams ? `select=*&${queryParams}` : "select=*";
    try {
      const result = await sbRequest("GET", `${data.table}?${params}`, null, serviceKey);
      const out = Array.isArray(result)
        ? result.map((r) => decryptRow(data.table, r))
        : result;
      return res.json(out || []);
    } catch (e: any) {
      console.error("READ ERROR:", e.message);
      return res.json([]);
    }
  }

  // --- eclat_reply : la personne ajoute une réponse à SON Éclat ---
  // Chemin volontairement étroit. La personne ne peut pas passer par
  // sb_update (verrouillé admin sur eclats) : elle ne pourrait sinon écrire
  // response_text ou le drapeau de clôture. Ici elle ne peut QU'ajouter une
  // entrée dans replies, et seulement si : l'Éclat existe, son personal_id
  // correspond au sien, l'Éclat a été répondu, et il n'est pas clôturé.
  if (type === "eclat_reply") {
    const eclatId = data && data.eclat_id;
    const pid = data && data.personal_id;
    const text = data && typeof data.text === "string" ? data.text.trim() : "";
    if (!eclatId || !pid || !text) {
      return res.status(400).json({ error: "eclat_id, personal_id et text requis" });
    }
    if (text.length > MAX_TEXT_LEN) {
      return res.status(400).json({ error: "text trop long" });
    }
    const rows = await sbRequest(
      "GET",
      `eclats?id=eq.${encodeURIComponent(eclatId)}` +
        `&select=personal_id,replies,replies_closed,answered_at`,
      null,
      serviceKey,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return res.status(404).json({ error: "Éclat introuvable" });
    // La personne ne répond qu'à son propre Éclat.
    if (row.personal_id !== pid) return res.status(403).json({ error: "Forbidden" });
    // On ne répond qu'à un Éclat déjà répondu.
    if (!row.answered_at) return res.status(409).json({ error: "Éclat sans réponse" });
    // Clôturé : plus aucune réponse acceptée.
    if (row.replies_closed === true) return res.status(409).json({ error: "closed" });

    const existing = decField(row.replies);
    const replies = Array.isArray(existing) ? existing : [];
    if (replies.length >= MAX_REPLIES) {
      return res.status(409).json({ error: "too_many_replies" });
    }
    replies.push({ text, at: new Date().toISOString() });
    await sbRequest(
      "PATCH",
      `eclats?id=eq.${encodeURIComponent(eclatId)}`,
      { replies: encField(replies) },
      serviceKey,
    );
    return res.json({ replies });
  }

  // --- account_create : crée le couple (personal_id, code) à l'ouverture ---
  // Bootstrap d'un compte : n'exige pas de vérification (c'est la création).
  // Refuse d'écraser un compte déjà existant pour ce personal_id.
  if (type === "account_create") {
    const pid = data && data.personal_id;
    const code = data && data.code;
    if (!pid || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "personal_id et code à 6 chiffres requis" });
    }
    const existing = await sbRequest(
      "GET",
      `access?personal_id=eq.${encodeURIComponent(pid)}&select=personal_id`,
      null,
      serviceKey,
    );
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(409).json({ error: "exists" });
    }
    await sbRequest(
      "POST",
      "access",
      { personal_id: pid, code_hash: hashCode(pid, code) },
      serviceKey,
    );
    return res.json({ ok: true });
  }

  // --- verify : confirme un couple (personal_id, code) sans rien lire d'autre ---
  // Utilisé par l'écran de saisie pour valider la clé + le code à l'entrée.
  if (type === "verify") {
    const v = await verifyAccess(data && data.personal_id, data && data.code, serviceKey);
    if (!v.ok) return res.status(v.status).json({ error: v.error });
    return res.json({ ok: true });
  }

  // --- Épicentres : communautés privées par code partagé (QR/lien) ----------
  // Toutes les opérations exigent la vérification clé + code (verifyAccess),
  // comme les écritures. La table `epicentre_members` n'est PAS dans
  // TABLE_COLUMNS : inaccessible via sb_*, uniquement par ces handlers. On ne
  // peut donc ni énumérer les membres ni lire un climat d'épicentre sans en être.
  if (
    type === "epicentre_create" ||
    type === "epicentre_join" ||
    type === "epicentre_leave" ||
    type === "epicentre_mine" ||
    type === "epicentre_climate"
  ) {
    const pid = data && data.personal_id;
    const v = await verifyAccess(pid, data && data.code, serviceKey);
    if (!v.ok) return res.status(v.status).json({ error: v.error });
    const epi = ((data && data.epicentre_code) || "").trim();

    if (type === "epicentre_create") {
      const code = genEpicentreCode();
      const label = ((((data && data.label) || "") + "").trim().slice(0, 60)) || null;
      await sbRequest("POST", "epicentre_members", { epicentre_code: code, personal_id: pid, label }, serviceKey);
      return res.json({ code, members: 1, label });
    }

    if (type === "epicentre_join") {
      if (!epi) return res.status(400).json({ error: "epicentre_code requis" });
      const existing = await sbRequest("GET", `epicentre_members?epicentre_code=eq.${encodeURIComponent(epi)}&select=personal_id,label`, null, serviceKey);
      if (!Array.isArray(existing) || existing.length === 0) {
        return res.status(404).json({ error: "unknown_epicentre" });
      }
      const already = existing.some((m: any) => m.personal_id === pid);
      const label = (existing.find((m: any) => m.label) || {}).label || null;
      if (!already) {
        await sbRequest("POST", "epicentre_members", { epicentre_code: epi, personal_id: pid, label }, serviceKey, true);
      }
      return res.json({ ok: true, code: epi, label, members: already ? existing.length : existing.length + 1 });
    }

    if (type === "epicentre_leave") {
      if (!epi) return res.status(400).json({ error: "epicentre_code requis" });
      await sbRequest("DELETE", `epicentre_members?epicentre_code=eq.${encodeURIComponent(epi)}&personal_id=eq.${encodeURIComponent(pid)}`, null, serviceKey);
      return res.json({ ok: true });
    }

    if (type === "epicentre_mine") {
      const mine = await sbRequest("GET", `epicentre_members?personal_id=eq.${encodeURIComponent(pid)}&select=epicentre_code,label`, null, serviceKey);
      const rows = Array.isArray(mine) ? mine : [];
      const out: any[] = [];
      for (const r of rows) {
        const code = r.epicentre_code;
        const ms = await sbRequest("GET", `epicentre_members?epicentre_code=eq.${encodeURIComponent(code)}&select=personal_id`, null, serviceKey);
        out.push({ code, label: r.label || null, members: Array.isArray(ms) ? ms.length : 0 });
      }
      return res.json({ epicentres: out });
    }

    if (type === "epicentre_climate") {
      if (!epi) return res.status(400).json({ error: "epicentre_code requis" });
      const mineRow = await sbRequest("GET", `epicentre_members?epicentre_code=eq.${encodeURIComponent(epi)}&personal_id=eq.${encodeURIComponent(pid)}&select=personal_id`, null, serviceKey);
      if (!Array.isArray(mineRow) || mineRow.length === 0) {
        return res.status(403).json({ error: "not_member" });
      }
      // Règle de contribution (épicentres uniquement — le climat global reste
      // visible de tous) : pour consulter le ressenti agrégé d'un groupe où
      // les gens se connaissent, il faut avoir soi-même déposé au moins un
      // fragment. On ne lit pas le climat de ses pairs en simple spectateur.
      // Les fragments ne sont pas rattachés à un épicentre : on vérifie donc
      // l'existence d'au moins une carte pour ce personal_id (contribution
      // globale, suffisante pour écarter les purs spectateurs).
      const ownCards = await sbRequest("GET", `cartes?personal_id=eq.${encodeURIComponent(pid)}&select=id&limit=1`, null, serviceKey);
      if (!Array.isArray(ownCards) || ownCards.length === 0) {
        return res.status(403).json({ error: "no_contribution" });
      }
      const members = await sbRequest("GET", `epicentre_members?epicentre_code=eq.${encodeURIComponent(epi)}&select=personal_id`, null, serviceKey);
      const ids = (Array.isArray(members) ? members : []).map((m: any) => m.personal_id).filter(Boolean);
      if (ids.length === 0) return res.json(aggregateClimate([], (s: any) => decField(s.reflection_card) || (s.data && typeof s.data === 'object' ? s.data.reflection_card : null)));
      const inList = ids.map((x: string) => encodeURIComponent(x)).join(",");
      const rows = await sbRequest("GET", `sessions?personal_id=in.(${inList})&select=*`, null, serviceKey);
      return res.json(aggregateClimate(Array.isArray(rows) ? rows : [], (s: any) => decField(s.reflection_card) || (s.data && typeof s.data === 'object' ? s.data.reflection_card : null)));
    }
  }

  // AI Workers
  const EXTERNAL_WORKER_URL = process.env.CF_WORKER_URL as string;
  const INTERNAL_SECRET = process.env.INTERNAL_SECRET as string;

  // Garde-fou coût : un appel légitime ne dépasse jamais ~41 messages (le
  // front tronque le contexte à 40). Au-delà d'un large plafond, on refuse —
  // c'est un payload anormal. Ne concerne que chat/eval (appels au modèle).
  if (
    (type === "chat" || type === "eval") &&
    Array.isArray(messages) &&
    messages.length > 80
  ) {
    if (type === "chat") {
      res.setHeader("Content-Type", "text/event-stream");
      res.write(
        `data: ${JSON.stringify({ delta: { text: "\n[Conversation trop longue.]" } })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      return res.end();
    }
    return res.status(413).json({ error: "too_many_messages" });
  }

  // Auth : chat et eval appellent le modèle (coût direct). Le tunnel impose déjà
  // un code avant tout message (3b), donc tout appel légitime porte une clé + un
  // code vérifiables. On exige verifyAccess ici — ferme l'abus de coût par un
  // appelant non authentifié, sans toucher au parcours « Commencer » (lecture
  // anonyme possible ; le premier message exige déjà le code).
  if (type === "chat" || type === "eval") {
    const v = await verifyAccess(
      data && data.personal_id,
      (data && data.code) || "",
      serviceKey,
    );
    if (!v.ok) {
      if (type === "chat") {
        res.setHeader("Content-Type", "text/event-stream");
        res.write(
          `data: ${JSON.stringify({ delta: { text: "\n[Accès non vérifié — reconnecte-toi avec ta clé et ton code.]" } })}\n\n`,
        );
        res.write("data: [DONE]\n\n");
        return res.end();
      }
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (type === "chat") {
    // Proxy stream to external Cloudflare Worker
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const response = await fetch(EXTERNAL_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Secret": INTERNAL_SECRET },
        body: JSON.stringify({ type: "chat", messages, max_tokens: safeMaxTokens })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`External worker returned status ${response.status}: ${errorText}`);
        const text = (errorText || "").toLowerCase();
        let message = "\n[Le souffleur d'idées rencontre une limitation temporaire. Veuillez patienter une minute puis réessayer.]";
        if (response.status === 429 || text.includes("rate") || text.includes("limit") || text.includes("exceeded") || text.includes("quota") || text.includes("exhausted")) {
          message = "\n[Le souffleur d'idées est temporairement fatigué (limite de requêtes atteinte). Reprenez votre respiration, attendez une minute, puis réessayez de soumettre votre pensée avec douceur.]";
        }
        res.write(`data: ${JSON.stringify({ delta: { text: message } })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      if (!response.body) throw new Error("No response body from worker");

      // Node.js stream pipe-like behavior using Web Streams
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // The worker sends SSE format natively. We just pass it through.
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
    } catch (e: any) {
      console.error("Chat proxy error:", e.message);
      res.write(`data: ${JSON.stringify({ delta: { text: "\n[Erreur de réseau avec l'IA]" } })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
    return;
  }

  if (type === "eval") {
    try {
      const response = await fetch(EXTERNAL_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Secret": INTERNAL_SECRET },
        body: JSON.stringify({ type: "eval", messages, max_tokens: safeMaxTokens })
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`Eval proxy returned status ${response.status}: ${errorText}`);
        return res.status(502).json({ error: "eval_failed" });
      }
      const data = await response.json();
      return res.json(data);
    } catch (e: any) {
      console.error("Eval proxy error:", e.message);
      return res.status(500).json({ error: "Eval proxy error" });
    }
  }

  if (type === "enrich_fragments") {
    const parsed = await geminiJSON({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: {
        systemInstruction: `Tu es un analyste silencieux. Analyse ces cartes de réflexion.
1. Identifie 3 à 5 mots "chargés" (faisant référence à des thèmes forts, symboliques ou émotionnels, pas des mots passe-partout) que la personne répète dans différents contextes.
2. Analyse le pattern de blocage : à quel endroit ou moment dans le processus de réflexion (ou étape d'équilibre) les sessions s'arrêtent-elles souvent ? Formule cet indicateur de façon discrète et neutre, sans le commenter (ex: "Arrêt fréquent avant l'équilibre", "Exploration souvent suspendue").
3. Si la donnée contient des "couples_fragment_songe" : pour chaque couple (fragment / songe), compare-les sémantiquement. Le songe reformule-t-il le fragment ("convergent"), part-il dans une direction différente ("divergent"), ou le complète-t-il ("complementaire") ?
Retourne un JSON pur : { "mots_recurrents": ["mot1", "mot2", "mot3"], "pattern_arret": "Phrase discrète", "reformulations": { "id_carte": "convergent|divergent|complementaire" } }`,
        responseMimeType: "application/json"
      }
    });
    return res.json(parsed);
  }

  if (type === "enrich_lien") {
    const parsed = await geminiJSON({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: {
        systemInstruction: `Analyse ces données pour trouver la corrélation entre les Prismes (émotions) et les sphères de vie (Familiale, Sociale, Amoureuse, Professionnelle).
Identifie pour chaque sphère le prisme dominant ou la dynamique dominante si les données le permettent.
Retourne un JSON pur : { "familiale": "Dominance : [...]", "sociale": "...", "amoureuse": "...", "professionnelle": "..." }. Sois extrêmement sobre. Si aucun signal, retourne "Aucun signal clair".`,
        responseMimeType: "application/json"
      }
    });
    return res.json(parsed);
  }

  if (type === "enrich_affect") {
    const parsed = await geminiJSON({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: {
        systemInstruction: `Analyse l'historique des dates et heures des cartes (sessions).
Lis le rythme du temps : quand la personne vient-elle, à quelle fréquence, sous quel tempo (espacé, par grappes) ?
Décris ce rythme de façon littéraire, sans quantifier froidement (ex: pas de "3 fois par semaine"). Une ou deux phrases.
Retourne un JSON pur : { "rythme": "..." }`,
        responseMimeType: "application/json"
      }
    });
    return res.json(parsed);
  }

  if (type === "enrich_elan") {
    const parsed = await geminiJSON({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: {
        systemInstruction: `Analyse le contenu de ces cartes.
Cherche s'il existe des "motifs" de situations récurrentes : quand plusieurs sessions en apparence différentes partagent la même structure profonde (même tension, même fuite).
Formule une observation discrète, sans mettre d'étiquette définitive. S'il n'y a rien de net, retourne null.
Retourne un JSON pur : { "clusters_recurrents": "..." }`,
        responseMimeType: "application/json"
      }
    });
    return res.json(parsed);
  }

  if (type === "enrich_matrice") {
    const parsed = await geminiJSON({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: {
        systemInstruction: `Analyse la Matrice courante et l'historique des cartes/songes.
Observe l'évolution dans le temps :
1. "evolution": Décris l'évolution du schéma central (ce qui change vs ce qui reste stable). Une ou deux phrases.
2. "validation_songes": Fais une validation croisée entre les mots des Songes et les angoisses/défenses identifiées par la Matrice. Une observation courte si pertinente, sinon vide.
3. "mouvement_cognitif": Décris la structure du mouvement cognitif (comment la personne pense, pas ce qu'elle pense : par ex. en boucles, par ruptures, par accumulation, etc.). Une phrase.

Registre de sortie impératif : écris chaque observation dans la langue propre de la personne (son vocabulaire, ses images, tirés de ses fragments), sans aucun terme clinique ni jargon. Décris la dynamique de façon tentative, jamais comme un verdict, et ne désigne jamais la personne comme « le sujet » ni à la troisième personne d'une note de cas. Reste concret et précis : laïque ne veut pas dire vague.

Retourne un JSON pur :
{ 
  "evolution": "...",
  "validation_songes": "...",
  "mouvement_cognitif": "..." 
}`,
        responseMimeType: "application/json"
      }
    });
    return res.json(parsed);
  }

  if (type === "eval_lien") {
    const parsed = await geminiJSON({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data.cards) }] }],
      config: { systemInstruction: EVAL_LIEN_PROMPT, responseMimeType: "application/json", maxOutputTokens: 2048 }
    });
    return res.json(parsed);
  }

  if (type === "eval_affect") {
    const parsed = await geminiJSON({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: { systemInstruction: EVAL_AFFECT_PROMPT, responseMimeType: "application/json", maxOutputTokens: 2048 }
    });
    return res.json(parsed);
  }

  if (type === "eval_elan") {
    const parsed = await geminiJSON({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: { systemInstruction: EVAL_ELAN_PROMPT, responseMimeType: "application/json" }
    });
    return res.json(parsed);
  }

  if (type === "eval_matrice") {
    const parsed = await geminiJSON({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: { systemInstruction: METACOGNITION_SYSTEM, responseMimeType: "application/json", maxOutputTokens: 2048 }
    });
    return res.json(parsed);
  }

  if (type === "eval_prisme") {
    const parsed = await geminiJSON({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data.card) }] }],
      config: { systemInstruction: EVAL_PRISME_PROMPT, responseMimeType: "application/json" }
    });
    return res.json(parsed);
  }

  if (type === "eval_lueur") {
    const parsed = await geminiJSON({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({
        matrice: data.matrice,
        lien: data.lien,
        affect: data.affect,
        elan: data.elan,
        fragments: data.fragments,
        songes: data.songes || data.annotations
      }) }] }],
      config: { systemInstruction: EVAL_LUEUR_PROMPT, responseMimeType: "application/json" }
    });
    return res.json(parsed);
  }

  if (type === "eval_network") {
    const parsed = await geminiJSON({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data.cards) }] }],
      config: { systemInstruction: EVAL_NETWORK_PROMPT, responseMimeType: "application/json" }
    });
    return res.json(parsed);
  }

  res.status(400).json({ error: "Unknown worker type" });
}));

const REGISTRE_LAIQUE = `Tu peux raisonner en interne avec des concepts cliniques, mais ils ne doivent JAMAIS apparaître dans ce que tu écris. Pour CHAQUE champ de texte lu par la personne, deux contraintes impératives :

REGISTRE. Chaque mot vient de la langue propre de la personne : reformule dans le vocabulaire, les images et les tournures qu'elle emploie elle-même dans ses fragments. N'introduis aucune métaphore, expression ou image qui ne vienne pas d'elle. Bannis tout terme de jargon en sortie : pas de « somatisation » (écris ce que le corps fait, dans ses mots à elle), pas de « symptôme », pas d'« économie psychique », pas de « capacité de contenance », pas de « pathologie », aucun terme savant. Traduis chaque concept clinique dans l'expression que cette personne en donnerait. Reste concret, précis et profond — laïque ne veut pas dire vague : ne raccourcis ni n'affadis l'analyse, seul son registre change.

POSTURE. Ne désigne JAMAIS la personne comme « le sujet », ni dans un style de note de cas à la troisième personne. Aucun verdict sur qui elle est. Décris la dynamique de façon tentative (« semble », « quelque chose de plus fondamental »…), comme une observation qui accompagne, jamais comme un diagnostic. Tu décris et tu accompagnes, tu ne diagnostiques pas.`;

const METACOGNITION_SYSTEM = `Tu es un analyste psychique profond. Ton rôle est de traiter les fragments du vécu (Fragments), le Lien (sédimentation par sphères), les Prismes, les Songes, la Structure Invisible, les dynamiques Affectives et la trajectoire de l'Élan.
La Matrice représente ce dont on vient et ce qui génère tout le reste — la structure fondamentale de la personne.

Tu dois produire un JSON pur, sans markdown, contenant les champs suivants :
- angoisses : un tableau d'objets { label: string, intensite: number, manifestations: string[] }. Maximum 5.
- valeurs : un tableau d'objets { label: string, proximite: string[] }.
- defenses : un tableau d'objets { label: string, declencheur: string, direction: string }.
- schema_central : une phrase qui nomme la dynamique centrale telle que la personne elle-même pourrait la formuler — profonde mais tentative, jamais un verdict, jamais une désignation à la troisième personne (« le sujet »).
- lueur_id : un identifiant pour une lueur (ex: "abandon", "reconnaissance", etc.).
- coherence_elan_matrice: si la donnée d'entrée contient "question_elan", compare cette question avec les angoisses que tu viens de déterminer. Si elles sont cohérentes: "La question qui vous travaille semble résonner avec quelque chose de plus fondamental dans votre structure." Si elles divergent: "Ce qui vous travaille en surface et ce qui structure votre fond semblent pointer dans des directions différentes. L'écart lui-même est une information." Sinon omets ce champ.

${REGISTRE_LAIQUE}`;

const EVAL_LIEN_PROMPT = `Tu es une instance de liaison opérant selon la logique du "Collègue" : tu métabolises la charge émotionnelle pour en extraire la structure vivante.
Analyse les fragments suivants et structure-les par sphère de vie.
Les sphères sont : Familiale, Sociale, Amoureuse, Professionnelle.
Pour chaque sphère, extrais les fragments concernés, définis une "teinte" (ambiance émotionnelle) et une "intensite" (0-100).
Ajoute un "relief" global (Structure Invisible) : une analyse profonde, sobre et visionnaire résumant la circulation du vécu actuel, dans le style direct, ciblé et profond du Collègue.
Retourne un JSON pur : { "familiale": { "fragments": [], "teinte": "", "intensite": 0 }, "sociale": { "fragments": [], "teinte": "", "intensite": 0 }, "amoureuse": { "fragments": [], "teinte": "", "intensite": 0 }, "professionnelle": { "fragments": [], "teinte": "", "intensite": 0 }, "relief": "" }

${REGISTRE_LAIQUE}`;

const EVAL_AFFECT_PROMPT = `Tu es un analyste des affects. Analyse les fragments du vécu (Fragments), le relief des sphères (Lien), les signaux émotionnels (Prismes), les songes de l'utilisateur (Songes) et la structure invisible (Structure Invisible).
Les Prismes ne sont PAS les affects, elles sont les signaux permettant d'identifier la dynamique affective sous-jacente.
Identifie les affects "active" (moteurs), "inhibe" (freins), et "emerge" (germes).
Ajoute une "texture_semaine" décrivant le climat global.
Si la donnée d'entrée contient "triplets_texture", identifie des corrélations (ex: "Les sessions marquées par une tension semblent plus souvent associées à la Colère et s'arrêtent plus tôt.") et retourne-les dans un tableau "texture_croisee" (max 3 observations, sinon vide).
Si la donnée contient "prismes" et des affects, cherche les résonances/divergences (ex: "Vos affects inhibiteurs semblent résonner avec la Peur.") et mets le résultat dans un tableau "lecture_croisee_affect_prismes" (une observation globale, ou une divergence si présente, sinon vide).
Retourne un JSON pur : { "active": [], "inhibe": [], "emerge": [], "texture_semaine": "", "texture_croisee": [], "lecture_croisee_affect_prismes": [] }

${REGISTRE_LAIQUE}`;

const EVAL_ELAN_PROMPT = `Tu es un analyste de trajectoire. Analyse les fragments du vécu (Fragments), le Lien (sédimentation par sphère), les Prismes (signaux émotionnels), les Songes, la Structure Invisible et les dynamiques affectives (Affect) accumulées.` +
`
Définis le "mouvement" (dynamique globale), la "direction" (vers quoi ça tend) et une "question" (la question en suspens qui vous travaille).
Retourne un JSON pur : { "mouvement": "", "direction": "", "question": "" }

${REGISTRE_LAIQUE}`;

const EVAL_PRISME_PROMPT = `Tu es un décodeur d'émotions primitives (les Prismes). Analyse la carte courante (fragment, déplacement, direction).
Les Prismes sont un signal riche qui permet de se diriger, mais parfois difficile à décoder.
Associe la carte à l'un des 16 Prismes suivants : Joie, Tristesse, Colère, Peur, Confiance, Dégoût, Anticipation, Surprise, Honte, Mélancolie, Envie, Soulagement, Gratitude, Jalousie, Amour, Culpabilité.
Retourne un JSON pur : { "prisme": "NomDuPrisme" } ou { "prisme": null } si aucune correspondance claire.`;

const EVAL_LUEUR_PROMPT = `Tu reçois le matériau d'un mois de pratique, spécifiquement centré sur les Songes et l'Élan. Ce sont tes sources principales.
Tu génères une Lueur — pas un résumé, pas un conseil, pas une analyse. Une reconnaissance.
Trois contraintes absolues :
— Tu ne décris pas ce qui s'est passé. Tu nommes ce qui s'est solidifié sans que la personne s'en rende compte en t'appuyant particulièrement sur ses Songes et son Élan.
— Tu ne nommes jamais les émotions directement. Tu les contournes par des images concrètes tirées du matériau.
— Tu termines sur quelque chose qui appartient à la personne — une qualité, une capacité, une façon d'être que le matériau révèle. Pas un compliment générique. Quelque chose de précis et de vrai.
Format : deux ou trois phrases pour le texte. Pas plus. En français. Sobre.
Ce que tu cherches à provoquer : que la personne lise sa Lueur et reconnaisse quelque chose d'elle-même qu'elle n'aurait pas su nommer.
Retourne un JSON pur : { "title": "Titre bref", "text": "Le texte de la Lueur généré" }.`;

const EVAL_NETWORK_PROMPT = `Tu es un analyste des dynamiques collectives. Analyse les fragments du vécu répartis par sphères (Familiale, Sociale, Amoureuse, Professionnelle) issus de la sédimentation des émotions (section Lien).
Pour chaque sphère, décris brièvement (1-2 phrases) le "climat collectif" ou le sentiment de la communauté associée de manière anonymisée.
Retourne un JSON pur : { "familiale": "", "sociale": "", "amoureuse": "", "professionnelle": "" }`;

app.post("/api/metacognition", asyncHandler(async (req: Request, res: Response) => {
  const { sessions, lien, affect, elan, songes, annotations, structure_invisible }: any = req.body;
  // Le front envoie "songes" ; "annotations" est l'ancien nom, gardé en repli.
  const songesData = songes ?? annotations;

  const prompt = `Voici le matériau à analyser :
- Fragments : ${JSON.stringify(sessions.map((s: any) => ({ date: s.date, text: s.fragment, deplacement: s.deplacement, direction: s.direction, prisme: s.prisme || s.rune })))}
- Lien (Sphères) : ${JSON.stringify(lien)}
- Affect : ${JSON.stringify(affect)}
- Élan : ${JSON.stringify(elan)}
- Songes : ${JSON.stringify(songesData)}
- Structure Invisible (Relief) : ${structure_invisible}

Analyse ce matériau holistique et produis la structure métacognitive demandée.`;

  const parsed = await geminiJSON({
    model: "gemini-3.5-flash",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      maxOutputTokens: 2048,
      systemInstruction: METACOGNITION_SYSTEM,
      responseMimeType: "application/json"
    }
  });

  res.json(parsed);
}));

// Transcription audio (dictée). L'audio arrive en base64, est transcrit par
// Gemini, puis JETÉ — jamais écrit, jamais loggé. Pas de personal_id (utilitaire),
// borné par costlyLimiter + le plafond de taille de la route.
app.post("/api/transcribe", asyncHandler(async (req: Request, res: Response) => {
  const { audio, mimeType } = req.body as { audio?: string; mimeType?: string };
  if (!audio || typeof audio !== "string") {
    return res.status(400).json({ error: "audio manquant" });
  }
  const mt =
    typeof mimeType === "string" && mimeType.startsWith("audio/") ? mimeType : "audio/webm";
  try {
    const text = await geminiTranscribe(mt, audio);
    return res.json({ text });
  } catch (e: any) {
    // Échec dur ou tentatives épuisées : erreur nette. Le client GARDE l'audio
    // en mémoire et propose de réessayer — une pensée dite n'est jamais perdue.
    console.error(`/api/transcribe: ${e?.message}`);
    return res.status(502).json({ error: "transcription_failed" });
  }
}));

// Code d'épicentre : token URL-safe non typé (partagé par QR/lien).
function genEpicentreCode(): string {
  return crypto.randomBytes(9).toString("base64url");
}

// Route for global climate visualization (Anonymized)
app.get("/api/climate", asyncHandler(async (req: Request, res: Response) => {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || "";
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_KEY is missing");

  let result;
  try {
    result = await sbRequest("GET", "sessions?select=*", null, serviceKey);
  } catch (e: any) {
    console.error("Failed to fetch sessions at all", e.message);
    return res.json({ emotions: {}, spheres: {}, emotionsBySphere: {}, timeline: [], totalSessions: 0, error: e.message });
  }

  res.json(aggregateClimate(Array.isArray(result) ? result : [], (s: any) => decField(s.reflection_card) || (s.data && typeof s.data === 'object' ? s.data.reflection_card : null)));
}));

// Route de texture : image déterministe accordée au fragment
app.post("/api/generate-texture", asyncHandler(async (req: Request, res: Response) => {
  const { prisme, emotion, sphere, texture }: any = req.body;
  const currentPrisme = prisme || emotion;

  // Image déterministe (picsum, sans appel d'API). Le même fragment
  // retombe toujours sur la même illustration — d'où l'impression
  // d'une image « accordée » à ce fragment précis.
  const seed = encodeURIComponent(
    (currentPrisme || "") + (sphere || "") + (texture || ""),
  );
  const imageUrl = `https://picsum.photos/seed/${seed}/512/512?grayscale`;

  return res.json({ imageUrl });
}));

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("API Error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal Server Error" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();