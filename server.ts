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

dotenv.config();

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

const PORT = 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://REDACTED.supabase.co";

// --- Schéma réel des tables (source de vérité, aligné sur Supabase) ---
// Toute écriture est filtrée sur ces colonnes : un champ inconnu envoyé par
// le front est ignoré au lieu de faire échouer la requête.
const TABLE_COLUMNS: Record<string, string[]> = {
  sessions:  ["id", "personal_id", "started_at", "ended_at", "step_reached", "messages", "reflection_card", "status"],
  cartes:    ["id", "personal_id", "fragment", "deplacement", "direction", "texture_relationnelle", "sphere", "emotion", "prisme", "date", "image_url", "user_note", "created_at"],
  carnet:    ["id", "personal_id", "plan", "lien_data", "affect_data", "elan_data", "matrice_data", "lueurs", "songes", "serpentin_state", "prismes_unlocked", "last_sync", "created_at"],
  eclats:    ["id", "personal_id", "type", "request_text", "matrice_snapshot", "elan_snapshot", "affect_snapshot", "lien_snapshot", "created_at"],
  feedbacks: ["id", "personal_id", "content", "rating", "created_at"],
};

// --- Plafond : nombre maximum de conversations réellement engagées par jour
// et par personal_id. Une session ouverte puis abandonnée aussitôt (ended_at
// vide) ne compte pas. C'est un garde-fou de coût, vérifié côté serveur.
const MAX_CONVERSATIONS_PER_DAY = 3;

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
app.use(express.json());

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

// Appelle Gemini en attendant un JSON. Gemini renvoie parfois un JSON malformé
// ou tronqué : dans ce cas l'appel est relancé une fois. Si la réponse est
// encore invalide, une erreur claire est levée — jamais un JSON.parse opaque.
async function geminiJSON(args: any): Promise<any> {
  args.config = {
    maxOutputTokens: 1024,                 // défaut prudent ; un caller peut le surcharger via config
    ...(args.config || {}),
    responseMimeType: "application/json",   // toujours imposé
  };
  let lastErr: any;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await ai.models.generateContent(args);
    const raw = (result.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    try {
      return JSON.parse(raw);
    } catch (e: any) {
      lastErr = e;
      console.warn(`geminiJSON: réponse non-JSON (tentative ${attempt}/2): ${e.message}`);
    }
  }
  throw new Error(`Gemini n'a pas renvoyé de JSON valide après 2 tentatives: ${lastErr?.message}`);
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
    if (res.status === 401) {
      console.error(`Supabase Unauthorized (${method} ${tablePath}). Check SUPABASE_SERVICE_KEY.`);
    } else {
      console.error(`Supabase Error (${method} ${tablePath}):`, errData);
    }
    throw new Error(`Supabase ${method} ${tablePath} failed (${res.status}): ${JSON.stringify(errData)}`);
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

app.post("/api/reflection", asyncHandler(async (req: Request, res: Response) => {
  const { prompt }: ReflectionRequest = req.body;

  const parsed = await geminiJSON({
    model: "gemini-3.5-flash",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 2048 }
  });

  res.json({ text: JSON.stringify(parsed) });
}));


// Supabase Proxy Routes (Compatibility with worker logic)
app.post("/api/worker", asyncHandler(async (req: Request, res: Response) => {
  const { type, data, messages, max_tokens }: ProxyRequest = req.body;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || "";
  const adminPassword = process.env.ADMIN_PASSWORD || "";

  if (!serviceKey) throw new Error("SUPABASE_SERVICE_KEY is missing");

  // Extract personal_id from payload or params to forward it to Supabase as header
  const personalId = (data?.payload && (data.payload.personal_id || data.payload.user_id)) ||
                     (data?.params && ((data.params.match(/personal_id=eq\.([^&]+)/) || [])[1] || (data.params.match(/user_id=eq\.([^&]+)/) || [])[1]));

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
    const payload = cleanPayload(data.table, data.payload);
    const row = await sbRequest("POST", data.table, payload, serviceKey, true);
    return res.json({ row: row ? row[0] : null });
  }

  if (type === "sb_update") {
    // La mise à jour est bornée à l'id, et aussi au personal_id appelant
    // quand il est connu : on ne peut pas écraser la ligne d'un autre utilisateur.
    const payload = cleanPayload(data.table, data.payload);
    const filter = personalId
      ? `${data.table}?id=eq.${encodeURIComponent(data.id)}&personal_id=eq.${encodeURIComponent(personalId)}`
      : `${data.table}?id=eq.${encodeURIComponent(data.id)}`;
    await sbRequest("PATCH", filter, payload, serviceKey);
    return res.json({ ok: true });
  }

  if (type === "sb_read") {
    // Lecture autorisée si : mot de passe admin, ou requête filtrée par personal_id.
    const queryParams = data.params || "";
    const hasUserFilter = queryParams.includes("personal_id=eq.");
    const authorized = (data.password && data.password === adminPassword) || hasUserFilter;
    if (!authorized) return res.status(401).json({ error: "Unauthorized" });

    const params = queryParams ? `select=*&${queryParams}` : "select=*";
    try {
      const result = await sbRequest("GET", `${data.table}?${params}`, null, serviceKey);
      return res.json(result || []);
    } catch (e: any) {
      console.error("READ ERROR:", e.message);
      return res.json([]);
    }
  }

  // AI Workers
  const EXTERNAL_WORKER_URL = process.env.CF_WORKER_URL || "https://internal-worker.example";
  const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "";

  if (type === "chat") {
    // Proxy stream to external Cloudflare Worker
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const response = await fetch(EXTERNAL_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Secret": INTERNAL_SECRET },
        body: JSON.stringify({ type: "chat", messages, max_tokens })
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
        body: JSON.stringify({ type: "eval", messages, max_tokens })
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`Eval proxy returned status ${response.status}: ${errorText}`);
        return res.status(response.status).json({ error: "eval_failed", message: errorText });
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
Cherche s'il existe des "clusters" de situations récurrentes : quand plusieurs sessions en apparence différentes partagent la même structure profonde (même tension, même fuite).
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

  if (type === "eclat") {
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: { systemInstruction: ECLAT_PROMPT, maxOutputTokens: 4096 }
    });
    return res.json({ text: result.text });
  }

  res.status(400).json({ error: "Unknown worker type" });
}));

const METACOGNITION_SYSTEM = `Tu es un analyste psychique profond. Ton rôle est de traiter les fragments du vécu (Fragments), le Lien (sédimentation par sphères), les Prismes, les Songes, la Structure Invisible, les dynamiques Affectives et la trajectoire de l'Élan.
La Matrice représente ce dont on vient et ce qui génère tout le reste — la structure fondamentale du sujet.

Tu dois produire un JSON pur, sans markdown, contenant les champs suivants :
- angoisses : un tableau d'objets { label: string, intensite: number, manifestations: string[] }. Maximum 5.
- valeurs : un tableau d'objets { label: string, proximite: string[] }.
- defenses : un tableau d'objets { label: string, declencheur: string, direction: string }.
- schema_central : une phrase sobre et profonde résumant le pattern dominant.
- lueur_id : un identifiant pour une lueur (ex: "abandon", "reconnaissance", etc.).
- coherence_elan_matrice: si la donnée d'entrée contient "question_elan", compare cette question avec les angoisses que tu viens de déterminer. Si elles sont cohérentes: "La question qui vous travaille semble résonner avec quelque chose de plus fondamental dans votre structure." Si elles divergent: "Ce qui vous travaille en surface et ce qui structure votre fond semblent pointer dans des directions différentes. L'écart lui-même est une information." Sinon omets ce champ.

Ta tonalité est sobre, clinique mais humaine, sans jargon excessif. Tu cherches la structure vivante derrière les mots.`;

const EVAL_LIEN_PROMPT = `Tu es une instance de liaison opérant selon la logique du "Collègue" : tu métabolises la charge émotionnelle pour en extraire la structure vivante.
Analyse les fragments suivants et structure-les par sphère de vie.
Les sphères sont : Familiale, Sociale, Amoureuse, Professionnelle.
Pour chaque sphère, extrais les fragments concernés, définis une "teinte" (ambiance émotionnelle) et une "intensite" (0-100).
Ajoute un "relief" global (Structure Invisible) : une analyse profonde, sobre et visionnaire résumant la circulation du vécu actuel, dans le style direct et pénétrant du Collègue.
Retourne un JSON pur : { "familiale": { "fragments": [], "teinte": "", "intensite": 0 }, "sociale": { "fragments": [], "teinte": "", "intensite": 0 }, "amoureuse": { "fragments": [], "teinte": "", "intensite": 0 }, "professionnelle": { "fragments": [], "teinte": "", "intensite": 0 }, "relief": "" }`;

const EVAL_AFFECT_PROMPT = `Tu es un analyste des affects. Analyse les fragments du vécu (Fragments), le relief des sphères (Lien), les signaux émotionnels (Prismes), les songes de l'utilisateur (Songes) et la structure invisible (Structure Invisible).
Les Prismes ne sont PAS les affects, elles sont les signaux permettant d'identifier la dynamique affective sous-jacente.
Identifie les affects "active" (moteurs), "inhibe" (freins), et "emerge" (germes).
Ajoute une "texture_semaine" décrivant le climat global.
Si la donnée d'entrée contient "triplets_texture", identifie des corrélations (ex: "Les sessions marquées par une tension semblent plus souvent associées à la Colère et s'arrêtent plus tôt.") et retourne-les dans un tableau "texture_croisee" (max 3 observations, sinon vide).
Si la donnée contient "prismes" et des affects, cherche les résonances/divergences (ex: "Vos affects inhibiteurs semblent résonner avec la Peur.") et mets le résultat dans un tableau "lecture_croisee_affect_prismes" (une observation globale, ou une divergence si présente, sinon vide).
Retourne un JSON pur : { "active": [], "inhibe": [], "emerge": [], "texture_semaine": "", "texture_croisee": [], "lecture_croisee_affect_prismes": [] }`;

const EVAL_ELAN_PROMPT = `Tu es un analyste de trajectoire. Analyse les fragments du vécu (Fragments), le Lien (sédimentation par sphère), les Prismes (signaux émotionnels), les Songes, la Structure Invisible et les dynamiques affectives (Affect) accumulées.` +
`
Définis le "mouvement" (dynamique globale), la "direction" (vers quoi ça tend) et une "question" (la question en suspens qui travaille le sujet).
Retourne un JSON pur : { "mouvement": "", "direction": "", "question": "" }`;

const EVAL_PRISME_PROMPT = `Tu es un décodeur d'émotions primitives (les Prismes). Analyse la carte courante (fragment, déplacement, direction).
Les Prismes sont un signal riche qui permet de se diriger, mais parfois difficile à décoder.
Associe la carte à l'un des 10 Prismes suivants : Joie, Tristesse, Colère, Peur, Confiance, Dégoût, Anticipation, Surprise, Honte, Mélancolie.
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

const ECLAT_PROMPT = `Tu es Claude, un analyste psychique d'une profondeur exceptionnelle.
Tu réalises une lecture "Éclat" : un acte ponctuel, rare et structurant, qui synthétise tout le matériau accumulé.
Prends en compte : cartes, Lien, Affect, Élan, Matrice, Prismes, Lueurs.
Produis une lecture dense, visionnaire et poétique. C'est une vision de structure, pas un conseil.
Retourne un texte libre, profond.`;

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

// Route for global climate visualization (Anonymized)
app.get("/api/climate", asyncHandler(async (req: Request, res: Response) => {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || "";
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_KEY is missing");

  let result;
  try {
    result = await sbRequest("GET", "sessions?select=*", null, serviceKey);
  } catch (e: any) {
    console.error("Failed to fetch sessions at all", e.message);
    return res.json({ emotions: {}, spheres: {}, totalSessions: 0, error: e.message });
  }

  const stats: any = {
    emotions: {},
    spheres: {},
    totalSessions: result ? result.length : 0
  };

  if (result && Array.isArray(result)) {
    result.forEach((s: any) => {
      const reflectionCard = s.reflection_card || (s.data && typeof s.data === 'object' ? s.data.reflection_card : null);
      if (reflectionCard) {
        const emotion = (reflectionCard.prisme || reflectionCard.rune || reflectionCard.emotion || "").toLowerCase();
        const sphere = reflectionCard.sphere;
        if (emotion) stats.emotions[emotion] = (stats.emotions[emotion] || 0) + 1;
        if (sphere) stats.spheres[sphere] = (stats.spheres[sphere] || 0) + 1;
      }
    });
  }

  res.json(stats);
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
  res.status(500).json({ error: err.message || "Internal Server Error" });
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