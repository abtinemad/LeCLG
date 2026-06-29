import type { Page, Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Filet d'interaction — mock serveur + pilotage UI (boîte noire).
//
// On pilote la VRAIE UI de /chat et on observe les VRAIES requêtes sortantes
// vers /api/**. Le handler FULFILL (au lieu d'abort comme le harnais visuel) ET
// ENREGISTRE chaque requête, pour asserter sur ce qui est POSTé — jamais sur des
// noms de fonctions internes. Ainsi le filet survit au refactor du moteur.
//
// Contrat /api/worker (POST, discriminé par `type`) + /api/reflection +
// /api/generate-texture : voir le détail dans recordAndFulfill ci-dessous.
// ---------------------------------------------------------------------------

export type WorkerRequest = {
  /** discriminant : sb_read | sb_insert | sb_update | chat | eval | eval_prisme | … */
  type: string;
  /** table ciblée pour les sb_* (sessions, cartes, carnet) ; undefined sinon. */
  table?: string;
  /** id ciblé pour sb_update ; undefined sinon. */
  id?: string;
  /** payload écrit (sb_insert/sb_update) ; undefined sinon. */
  payload?: any;
  /** corps brut entièrement parsé (filet de sécurité pour des assertions fines). */
  raw: any;
  /** URL complète (pour distinguer /reflection, /generate-texture, …). */
  url: string;
};

// Identité seedée comme l'écran chat-accueil (au-delà de l'accueil → day-picker
// visible d'emblée, aucune création de code).
const IDENTITY = {
  collegue_personal_id: "engine-fixture-cle-0001",
  collegue_access_code: "000000",
  // Supprime le didacticiel « Clarté » de la section chat (sinon overlay).
  collegue_clarte_seen_chat: "1",
};

// Réponse du collègue simulée par le flux SSE `chat`.
export const MOCK_REPLY = "Réponse simulée du collègue.";

// EvalResult cumulatif : niveau n ⇒ les n premiers temps débloqués, dans l'ordre
// situation → ressenti → demande → diffraction → equilibre. emotional_charge
// bas (1) pour ne jamais déclencher le message de rupture (>= 3).
function evalResultBody(level: number) {
  const r = {
    situation: level >= 1,
    ressenti: level >= 2,
    demande: level >= 3,
    diffraction: level >= 4,
    equilibre: level >= 5,
    diffraction_sans_partage: false,
    crise: false,
    routage_sante: false,
    projection: false,
    reconnaissance_pattern: false,
    alliance: 1,
    emotional_charge: 1,
    collegue_posture: 0,
    tension: 0,
    mots_cles: [],
  };
  // L'app lit data.content[0].text comme une CHAÎNE JSON.
  return { content: [{ type: "text", text: JSON.stringify(r) }] };
}

// Niveau dérivé du NOMBRE de vrais messages de la personne dans la requête eval
// (hors messages synthétiques injectés par l'app), borné à 5. Chaque message
// utilisateur fait donc avancer d'exactement un temps.
function evalLevelFrom(body: any): number {
  const msgs: any[] = Array.isArray(body?.messages) ? body.messages : [];
  const real = msgs.filter(
    (m) =>
      m.role === "user" &&
      !String(m.content ?? "").startsWith("(Début de l'échange)") &&
      !String(m.content ?? "").includes(
        "Analyse la conversation selon tes instructions",
      ),
  );
  return Math.min(real.length, 5);
}

// Carte de réflexion renvoyée par /api/reflection — objet JSON valide, SANS
// ended_at (invariant : la carte ne porte jamais ended_at).
const MOCK_CARD = {
  fragment: "un fil resté tendu au travail",
  deplacement: "de l'urgence subie vers une attention plus posée",
  deplacement_type: "nomination",
  direction: "poser une limite claire sans rompre le lien",
  direction_type: "décision",
  texture_relationnelle: "posée, attentive",
  sphere: "Professionnelle",
  emotion: "confiance",
  prisme: "confiance",
};

function sseBody(text: string): string {
  return (
    `data: ${JSON.stringify({ delta: { text } })}\n\n` + `data: [DONE]\n\n`
  );
}

// Le cœur du filet : enregistre la requête puis répond selon le contrat.
async function recordAndFulfill(route: Route, records: WorkerRequest[]) {
  const req = route.request();
  const url = req.url();
  let body: any = null;
  try {
    body = JSON.parse(req.postData() || "null");
  } catch {
    body = null;
  }

  const data = body?.data ?? {};
  records.push({
    type: body?.type ?? "(unknown)",
    table: data?.table,
    id: data?.id,
    payload: data?.payload,
    raw: body,
    url,
  });

  const json = (obj: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(obj),
    });

  // Endpoints hors /api/worker.
  if (url.endsWith("/api/reflection")) {
    return json({ text: JSON.stringify(MOCK_CARD) });
  }
  if (url.endsWith("/api/generate-texture")) {
    return json({}); // pas d'imageUrl → aucune écriture d'image parasite
  }
  if (!url.endsWith("/api/worker")) {
    return json({}); // metacognition & co. : neutre
  }

  // /api/worker, discriminé par `type`.
  switch (body?.type) {
    case "sb_read":
      // TABLEAU. [] ⇒ non plafonné, aucune session passée, carnet vide.
      return json([]);
    case "sb_insert":
      // ⚠️ id lu dans result.row.id — sans le wrapper {row:{id}},
      // currentSessionId reste null et saveSession/abandon sortent en silence.
      return json({ row: { id: `engine-${data?.table || "row"}-id` } });
    case "sb_update":
      return json({ row: {} });
    case "chat":
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody(MOCK_REPLY),
      });
    case "eval":
      return json(evalResultBody(evalLevelFrom(body)));
    case "eval_prisme":
      return json({}); // garde l'emotion déjà posée par la carte
    case "account_create":
      return json({ ok: true }); // non atteint (code seedé), neutre par sécurité
    default:
      return json({});
  }
}

// Installe le mock + seed localStorage AVANT toute navigation. Retourne le
// tableau (vivant) des requêtes enregistrées.
export async function setupEngine(page: Page): Promise<WorkerRequest[]> {
  const records: WorkerRequest[] = [];
  // Rend les taps de pastille immédiats (sinon délai FOCUS_MS de 2,2 s) et fige
  // les animations.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", (route) => recordAndFulfill(route, records));
  await page.addInitScript((identity) => {
    try {
      localStorage.clear();
      for (const [k, v] of Object.entries(identity)) localStorage.setItem(k, v);
    } catch {
      /* private mode — rien à faire */
    }
  }, IDENTITY);
  return records;
}

// ── Pilotage UI (sélecteurs dérivés du code de Chat.tsx) ───────────────────

const SEND_COMBO =
  process.platform === "darwin" ? "Meta+Enter" : "Control+Enter";

export async function gotoChat(page: Page) {
  await page.goto("/chat", { waitUntil: "domcontentloaded" });
  // Day-picker (accueil) prêt.
  await page
    .getByText("C'est quoi, là, maintenant ?", { exact: false })
    .waitFor({ state: "visible" });
}

// Démarre une session via le clic d'une pastille de l'état du jour, puis attend
// l'opener (à froid, instantané) et la zone de saisie active.
export async function startSession(page: Page) {
  await page.getByRole("button", { name: "juste un truc banal" }).click();
  // L'opener à froid s'affiche et la saisie redevient active (loading=false).
  await page.locator("textarea:not([disabled])").first().waitFor();
}

const replyLocator = (page: Page) =>
  page.getByText(MOCK_REPLY, { exact: false });

// Envoie un message de la personne et attend qu'UNE réponse simulée de plus soit
// rendue (preuve que le tour s'est bouclé). Texte > 20 car. pour déclencher
// l'eval de façon fiable.
export async function sendUser(page: Page, text: string) {
  const before = await replyLocator(page).count();
  const ta = page.locator("textarea");
  await ta.fill(text);
  await ta.press(SEND_COMBO);
  await replyLocator(page).nth(before).waitFor({ state: "visible" });
}

// Attend la carte « Émergence identifiée » et valide l'étape ; attend ensuite la
// synthèse (une réponse simulée de plus).
export async function validatePending(page: Page) {
  const btn = page.getByRole("button", { name: "Valider l'étape" });
  await btn.waitFor({ state: "visible", timeout: 20_000 });
  const before = await replyLocator(page).count();
  await btn.click();
  await replyLocator(page).nth(before).waitFor({ state: "visible" });
}

// Déclenche le pagehide (abandon) sans naviguer.
export async function firePageHide(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
  });
}

// ── Prédicats d'assertion sur les requêtes enregistrées ────────────────────

const hasEndedAt = (p: any) =>
  p != null && typeof p === "object" && p.ended_at != null;

export const isSessionsUpdate = (r: WorkerRequest) =>
  r.type === "sb_update" && r.table === "sessions";

export const isSessionsEndedAt = (r: WorkerRequest) =>
  isSessionsUpdate(r) && hasEndedAt(r.payload);

export const isAbandon = (r: WorkerRequest) =>
  r.type === "sb_update" &&
  r.table === "sessions" &&
  r.payload?.status === "abandoned";

export const isCartesInsert = (r: WorkerRequest) =>
  r.type === "sb_insert" && r.table === "cartes";

export const anySessionsHasEndedAt = (recs: WorkerRequest[]) =>
  recs.some((r) => r.table === "sessions" && hasEndedAt(r.payload));

export const anyCartesHasEndedAt = (recs: WorkerRequest[]) =>
  recs.some((r) => r.table === "cartes" && hasEndedAt(r.payload));

export const anyAbandonHasEndedAt = (recs: WorkerRequest[]) =>
  recs.some((r) => r.payload?.status === "abandoned" && hasEndedAt(r.payload));
