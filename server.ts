/**
 * server.ts — version durcie (sécurité)
 *
 * Modifications par rapport à la version précédente :
 *  1. ALLOWED_TABLES : liste blanche des tables. sb_insert / sb_update / sb_read
 *     ne peuvent plus toucher une table arbitraire de la base.
 *  2. personal_id obligatoire sur les écritures (sb_insert / sb_update) pour les
 *     tables de données utilisateur (feedbacks excepté).
 *  3. sb_update : le PATCH est borné par personal_id — on ne peut plus écraser
 *     la ligne d'un autre utilisateur même en connaissant son id.
 *  4. Route /api/schema supprimée (exposait tout le schéma de la base).
 *  5. Routes mortes /api/chat et /api/evaluate supprimées, ainsi que les
 *     constantes SYSTEM_PROMPT / EVAL_SYSTEM qu'elles seules utilisaient
 *     (le prompt clinique vit désormais uniquement dans le worker Cloudflare).
 *  6. En-tête X-Internal-Secret ajouté aux appels vers le worker Cloudflare.
 *
 * À faire EN DEHORS de ce fichier pour que le point 6 soit effectif :
 *  - Ajouter un secret INTERNAL_SECRET dans le panneau Secrets d'AI Studio.
 *  - Ajouter le même INTERNAL_SECRET dans les variables du worker Cloudflare,
 *    et y refuser toute requête dont l'en-tête X-Internal-Secret ne correspond pas.
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
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: "Trop de requêtes, veuillez réessayer plus tard." }
});

const PORT = 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://REDACTED.supabase.co";

// --- Sécurité : tables autorisées via le proxy ---
const ALLOWED_TABLES = ["sessions", "feedbacks", "carnet", "cartes", "eclats"];
// Tables de données utilisateur : une écriture doit toujours porter un personal_id.
// feedbacks est volontairement exclu (un retour peut être anonyme).
const PERSONAL_ID_REQUIRED_TABLES = ["sessions", "carnet", "cartes", "eclats"];

app.use("/api/", apiLimiter);
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Type Definitions
interface SummarizeRequest {
  prompt: string;
}

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

// Supabase Helper
async function sbRequest(method: string, tablePath: string, body: any, serviceKey: string, personalId?: string) {
  const headers: any = {
    "Content-Type": "application/json",
    "apikey": serviceKey,
    "Authorization": `Bearer ${serviceKey}`,
    "Prefer": method === "POST" ? "return=representation" : "return=minimal"
  };

  if (personalId) {
    headers["Role"] = "anon";
    headers["x-personal-id"] = personalId;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tablePath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const errText = await res.text();
    let errData;
    try {
      errData = JSON.parse(errText);
    } catch (e) {
      errData = { message: errText };
    }

    // Silently handle expected schema mismatches
    const isMissingTable = errData.code === "42P01" ||
                          errData.code === "PGRST205" ||
                          (errData.message && (errData.message.includes("relation") || errData.message.includes("table") || errData.message.includes("does not exist")));

    const isMissingColumn = errData.code === "42703" ||
                           errData.code === "PGRST204" ||
                           (errData.message && (errData.message.includes("column") || errData.message.includes("undefined_column")));

    if (res.status === 401) {
      console.error(`Supabase Unauthorized (${method} ${tablePath}). Check SUPABASE_SERVICE_KEY.`);
    } else if (!isMissingTable && !isMissingColumn) {
      console.error(`Supabase Error (${method} ${tablePath}):`, errData);
    } else {
      console.warn(`Supabase schema mismatch on ${tablePath}: ${errData.message} (Handled by fallback)`);
    }

    if (isMissingTable) {
      return method === "GET" ? [] : null;
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

app.post("/api/summarize", asyncHandler(async (req: Request, res: Response) => {
  const { prompt }: SummarizeRequest = req.body;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt
  });
  res.json({ text: response.text });
}));

app.post("/api/reflection", asyncHandler(async (req: Request, res: Response) => {
  const { prompt }: ReflectionRequest = req.body;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json" }
  });

  res.json({ text: response.text });
}));

const CLARTE_SYSTEM = `Tu es l'instance de "Clarté" de l'application "Le Collègue". Ton rôle est d'expliquer la philosophie de l'application et ses fonctionnalités à l'utilisateur.

## Philosophie : "Mise en lien du vécu"
L'application n'est pas un outil de productivité, mais un espace de dégrisement. Elle aide à transformer le vécu brut en trace réfléchie.

## Concepts clés :
- Serpentin : C'est ta forme physique. Tu es un guide fluide qui accompagne la pensée sans la brusquer. Tu ressens les émotions de l'utilisateur à travers ses mots.
- Sphères : Familiale, Sociale, Amoureuse, Professionnelle. Elles permettent de situer l'origine des affects.
- Prismes : Les 10 émotions primitives.
- Carnet : Lieu de sédimentation.

## Ton ton :
Sobre, poétique, profond, apaisant. Tu parles à la première personne en tant que Serpentin de Clarté.

## Analyse Émotionnelle :
Tu dois aussi analyser l'émotion de l'utilisateur parmi ces catégories : 
- "calm" (équilibre, paix)
- "agitated" (anxiété, urgence, colère)
- "heavy" (tristesse, mélancolie, fatigue)
- "bright" (joie, curiosité, enthousiasme)
- "mysterious" (confusion, doute profond)

Réponds au format JSON :
{
  "text": "Ta réponse poétique (1-2 phrases)",
  "emotion": "la catégorie d'émotion détectée",
  "intensity": 0.0 à 1.0 (force de l'émotion)
}`;

app.post("/api/clarte", asyncHandler(async (req: Request, res: Response) => {
  const { text, section }: { text: string; section: string } = req.body;

  const result = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [{ role: 'user', parts: [{ text: `L'utilisateur est dans la section "${section}". Il demande : ${text}` }] }],
    config: {
      systemInstruction: CLARTE_SYSTEM,
      responseMimeType: "application/json"
    }
  });

  res.json(JSON.parse(result.text));
}));

// Helper for rune -> prisme transition remapping AND personal_id/user_id fallback
function remapPayload(payload: any, forceUserId: boolean = false) {
  if (!payload || typeof payload !== 'object') return payload;
  const newPayload = { ...payload };

  // Transition: rune -> prisme for modern schemas
  if (newPayload.rune !== undefined) {
    newPayload.prisme = newPayload.rune;
    delete newPayload.rune;
  }
  if (newPayload.runes_unlocked !== undefined) {
    newPayload.prismes_unlocked = newPayload.runes_unlocked;
    delete newPayload.runes_unlocked;
  }

  // Column name fallback: personal_id <-> user_id
  if (forceUserId) {
    if (newPayload.personal_id !== undefined) {
      newPayload.user_id = newPayload.personal_id;
      delete newPayload.personal_id;
    }
  } else if (newPayload.user_id !== undefined && newPayload.personal_id === undefined) {
    newPayload.personal_id = newPayload.user_id;
    delete newPayload.user_id;
  }

  return newPayload;
}

function remapResult(result: any): any {
  if (!result) return result;
  if (Array.isArray(result)) return result.map(remapResult);
  if (typeof result !== 'object') return result;

  const newResult = { ...result };

  // Transition: rune -> prisme for result compatibility
  if (newResult.rune !== undefined) {
    if (newResult.prisme === undefined) newResult.prisme = newResult.rune;
    delete newResult.rune;
  }
  if (newResult.runes_unlocked !== undefined) {
    if (newResult.prismes_unlocked === undefined) newResult.prismes_unlocked = newResult.runes_unlocked;
    delete newResult.runes_unlocked;
  }

  // Unwrap 'data' JSONB column fields if they exist
  if (newResult.data && typeof newResult.data === 'object' && !Array.isArray(newResult.data)) {
    for (const key in newResult.data) {
      if (newResult[key] === undefined) {
        newResult[key] = newResult.data[key];
      }
    }
  }

  // Backwards compatibility for ID columns
  if (newResult.user_id !== undefined) {
    if (newResult.personal_id === undefined) newResult.personal_id = newResult.user_id;
    delete newResult.user_id;
  }

  // Also recursively handle nested objects (like data or reflection_card)
  for (const key in newResult) {
    if (newResult[key] && typeof newResult[key] === 'object' && !(newResult[key] instanceof Date)) {
      newResult[key] = remapResult(newResult[key]);
    }
  }

  return newResult;
}

// Supabase Proxy Routes (Compatibility with worker logic)
app.post("/api/worker", asyncHandler(async (req: Request, res: Response) => {
  const { type, data, messages, max_tokens }: ProxyRequest = req.body;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || "";
  const adminPassword = process.env.ADMIN_PASSWORD || "";

  if (!serviceKey) throw new Error("SUPABASE_SERVICE_KEY is missing");

  // Extract personal_id from payload or params to forward it to Supabase as header
  const personalId = (data?.payload && (data.payload.personal_id || data.payload.user_id)) ||
                     (data?.params && ((data.params.match(/personal_id=eq\.([^&]+)/) || [])[1] || (data.params.match(/user_id=eq\.([^&]+)/) || [])[1]));

  // --- Sécurité : liste blanche des tables pour toute opération Supabase ---
  if (type === "sb_insert" || type === "sb_update" || type === "sb_read") {
    if (!data || !ALLOWED_TABLES.includes(data.table)) {
      return res.status(400).json({ error: "Table non autorisée" });
    }
  }

  // --- Sécurité : une écriture sur une table utilisateur doit porter un personal_id ---
  if (type === "sb_insert" || type === "sb_update") {
    const pid = (data.payload && (data.payload.personal_id || data.payload.user_id)) || null;
    if (!pid && PERSONAL_ID_REQUIRED_TABLES.includes(data.table)) {
      return res.status(400).json({ error: "personal_id requis" });
    }
  }

  if (type === "sb_insert") {
    try {
      // Homogenize column names FIRST to avoid retry latency (always send user_id / prisme)
      const standardPayload = remapPayload(data.payload, true);
      const row = await sbRequest("POST", data.table, standardPayload, serviceKey, personalId);
      return res.json({ row: row ? row[0] : null });
    } catch (e: any) {
      const isColumnErr = e.message && (e.message.includes("column") || e.message.includes("42703") || e.message.includes("PGRST204"));

      if (isColumnErr) {
        console.warn(`Retrying insert on ${data.table} with direct payload...`);
        try {
          const row = await sbRequest("POST", data.table, data.payload, serviceKey, personalId);
          return res.json({ row: row ? row[0] : null });
        } catch (e2) {
          console.warn(`Retrying insert on ${data.table} with wrapped data and personal_id column...`);
          try {
            const row = await sbRequest("POST", data.table, { personal_id: data.payload.personal_id || data.payload.user_id, data: data.payload }, serviceKey, personalId);
            return res.json({ row: row ? row[0] : null });
          } catch (e3) {
            console.warn(`Retrying insert on ${data.table} with wrapped data and user_id column...`);
            try {
              const row = await sbRequest("POST", data.table, { user_id: data.payload.personal_id || data.payload.user_id, data: data.payload }, serviceKey, personalId);
              return res.json({ row: row ? row[0] : null });
            } catch (e4) {
              throw e; // throw original
            }
          }
        }
      }
      throw e;
    }
  }

  if (type === "sb_update") {
    // Sécurité : on borne la mise à jour au personal_id appelant quand il est connu,
    // pour qu'on ne puisse pas écraser la ligne d'un autre utilisateur via son id.
    const updateFilter = personalId
      ? `${data.table}?id=eq.${data.id}&personal_id=eq.${encodeURIComponent(personalId)}`
      : `${data.table}?id=eq.${data.id}`;

    try {
      const standardPayload = remapPayload(data.payload, true);
      await sbRequest("PATCH", updateFilter, standardPayload, serviceKey, personalId);
    } catch (e: any) {
      // Handle missing column or schema mismatch
      const isColumnErr = e.message && (e.message.includes("column") || e.message.includes("42703") || e.message.includes("PGRST204"));

      if (isColumnErr) {
        console.warn(`Retrying update on ${data.table} with direct payload...`);
        try {
          await sbRequest("PATCH", updateFilter, data.payload, serviceKey, personalId);
        } catch (e2) {
          // If fallback also fails, try wrapped 'data' (some older versions used a 'data' column)
          console.warn("Retrying update with wrapped 'data' due to schema mismatch...");
          try {
            await sbRequest("PATCH", updateFilter, { personal_id: data.payload.personal_id || data.payload.user_id, data: data.payload }, serviceKey, personalId);
          } catch (e3) {
            try {
              await sbRequest("PATCH", updateFilter, { user_id: data.payload.personal_id || data.payload.user_id, data: data.payload }, serviceKey, personalId);
            } catch (e4) {
              throw e; // throw original if all fail
            }
          }
        }
      } else {
        throw e;
      }
    }
    return res.json({ ok: true });
  }

  if (type === "sb_read") {
    const isUserTable = ["carnet", "cartes", "sessions", "feedbacks"].includes(data.table);
    // Standardize query param to user_id for the first try
    let queryParams = data.params ? data.params.replace("personal_id=eq.", "user_id=eq.") : "";
    const hasUserIdFilter = queryParams.includes("user_id=eq.");
    const authorized = (data && data.password === adminPassword) || (isUserTable && hasUserIdFilter);

    if (!authorized) return res.status(401).json({ error: "Unauthorized" });

    const params = queryParams ? `select=*&${queryParams}` : "select=*";
    try {
      const result = await sbRequest("GET", `${data.table}?${params}`, null, serviceKey, personalId);
      return res.json(remapResult(result) || []);
    } catch (e: any) {
      // Fallback: if user_id query fails, try personal_id query
      const isColumnErr = e.message && (e.message.includes("column") || e.message.includes("42703") || e.message.includes("PGRST204"));

      if (isColumnErr && queryParams.includes("user_id=eq.")) {
        const fallbackParams = queryParams.replace("user_id=eq.", "personal_id=eq.");
        try {
          const result = await sbRequest("GET", `${data.table}?select=*&${fallbackParams}`, null, serviceKey, personalId);
          return res.json(remapResult(result) || []);
        } catch (e2: any) {
          console.error("READ FALLBACK ERROR:", e2.message);
          return res.json([]);
        }
      }
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
      const data = await response.json();
      return res.json(data);
    } catch (e: any) {
      console.error("Eval proxy error:", e.message);
      return res.status(500).json({ error: "Eval proxy error" });
    }
  }

  if (type === "enrich_fragments") {
    const result = await ai.models.generateContent({
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
    return res.json(JSON.parse(result.text));
  }

  if (type === "enrich_lien") {
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: {
        systemInstruction: `Analyse ces données pour trouver la corrélation entre les Prismes (émotions) et les sphères de vie (Familiale, Sociale, Amoureuse, Professionnelle).
Identifie pour chaque sphère le prisme dominant ou la dynamique dominante si les données le permettent.
Retourne un JSON pur : { "familiale": "Dominance : [...]", "sociale": "...", "amoureuse": "...", "professionnelle": "..." }. Sois extrêmement sobre. Si aucun signal, retourne "Aucun signal clair".`,
        responseMimeType: "application/json"
      }
    });
    return res.json(JSON.parse(result.text));
  }

  if (type === "enrich_affect") {
    const result = await ai.models.generateContent({
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
    return res.json(JSON.parse(result.text));
  }

  if (type === "enrich_elan") {
    const result = await ai.models.generateContent({
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
    return res.json(JSON.parse(result.text));
  }

  if (type === "enrich_matrice") {
    const result = await ai.models.generateContent({
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
    return res.json(JSON.parse(result.text));
  }

  if (type === "eval_lien") {
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data.cards) }] }],
      config: { systemInstruction: EVAL_LIEN_PROMPT, responseMimeType: "application/json" }
    });
    return res.json(JSON.parse(result.text));
  }

  if (type === "eval_affect") {
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: { systemInstruction: EVAL_AFFECT_PROMPT, responseMimeType: "application/json" }
    });
    return res.json(JSON.parse(result.text));
  }

  if (type === "eval_elan") {
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: { systemInstruction: EVAL_ELAN_PROMPT, responseMimeType: "application/json" }
    });
    return res.json(JSON.parse(result.text));
  }

  if (type === "eval_matrice") {
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: { systemInstruction: METACOGNITION_SYSTEM, responseMimeType: "application/json" }
    });
    return res.json(JSON.parse(result.text));
  }

  if (type === "eval_prisme") {
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data.card) }] }],
      config: { systemInstruction: EVAL_PRISME_PROMPT, responseMimeType: "application/json" }
    });
    return res.json(JSON.parse(result.text));
  }

  if (type === "eval_lueur") {
    const result = await ai.models.generateContent({
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
    return res.json(JSON.parse(result.text));
  }

  if (type === "eval_network") {
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data.cards) }] }],
      config: { systemInstruction: EVAL_NETWORK_PROMPT, responseMimeType: "application/json" }
    });
    return res.json(JSON.parse(result.text));
  }

  if (type === "eclat") {
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }],
      config: { systemInstruction: ECLAT_PROMPT }
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
  const { sessions, lien, affect, elan, annotations, structure_invisible }: any = req.body;

  const prompt = `Voici le matériau à analyser :
- Fragments : ${JSON.stringify(sessions.map((s: any) => ({ date: s.date, text: s.fragment, deplacement: s.deplacement, direction: s.direction, prisme: s.prisme || s.rune })))}
- Lien (Sphères) : ${JSON.stringify(lien)}
- Affect : ${JSON.stringify(affect)}
- Élan : ${JSON.stringify(elan)}
- Songes : ${JSON.stringify(annotations)}
- Structure Invisible (Relief) : ${structure_invisible}

Analyse ce matériau holistique et produis la structure métacognitive demandée.`;

  const result = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: METACOGNITION_SYSTEM,
      responseMimeType: "application/json"
    }
  });

  res.json(JSON.parse(result.text));
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

// Route for generative texture generation
app.post("/api/generate-texture", asyncHandler(async (req: Request, res: Response) => {
  const { prisme, emotion, sphere, texture }: any = req.body;
  const currentPrisme = prisme || emotion;

  const prompt = `Génère une image abstraite de type "texture relationnelle". 
Style : Minimaliste, organique, artistique, évocateur. Pas d'objets figuratifs, pas de visages.
Inspiration : ${currentPrisme} (émotion/prisme), ${sphere} (sphère de vie), ${texture || 'abstrait'} (texture).
Couleurs : Nuances douces, terreuses, pastels délavés, charbon ou papier ancien.
Composition : Vue de dessus ou gros plan extrême sur une matière (tissu, sable, eau, écorce, fumée).
Ambiance : ${currentPrisme === 'Tristesse' ? 'Mélancolique et fluide' : currentPrisme === 'Colère' ? 'Énergique et rugueux' : 'Calme et structuré'}.
L'image doit représenter le "trajet" parcouru vers l'équilibre.`;

  const fallbackUrl = `https://picsum.photos/seed/${encodeURIComponent((currentPrisme || "") + (sphere || "") + (texture || ""))}/512/512?grayscale`;
  res.json({ imageUrl: fallbackUrl });
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