import { test, expect } from "@playwright/test";
import {
  setupEngine,
  gotoChat,
  startSession,
  sendUser,
  validatePending,
  firePageHide,
  anySessionsHasEndedAt,
  anyCartesHasEndedAt,
  anyAbandonHasEndedAt,
  isAbandon,
  isSessionsEndedAt,
  isCartesInsert,
  type WorkerRequest,
} from "./fixture";

// Messages de la personne — toujours > 20 caractères (déclenche l'eval).
const U = (n: number) =>
  `Message numéro ${n} de la personne, assez long pour être pris en compte.`;

// ── Scénario A — sous le seuil + abandon ──────────────────────────────────
test("A — sous le seuil d'engagement puis abandon (pagehide)", async ({
  page,
}) => {
  const records = await setupEngine(page);
  await gotoChat(page);
  await startSession(page);

  await sendUser(page, U(1));
  await sendUser(page, U(2));

  await firePageHide(page);

  // (1) une sb_update "sessions" avec status === "abandoned".
  await expect
    .poll(() => records.filter(isAbandon).length, { timeout: 10_000 })
    .toBeGreaterThan(0);

  // (2) AUCUNE requête "sessions" ne contient ended_at.
  expect(anySessionsHasEndedAt(records)).toBe(false);
});

// ── Scénario B — au-dessus du seuil ───────────────────────────────────────
test("B — au-dessus du seuil : ended_at posé par une update sessions", async ({
  page,
}) => {
  const records = await setupEngine(page);
  await gotoChat(page);
  await startSession(page);

  // 4 messages user (> 3) ⇒ saveSession pose ended_at au 4e tour.
  await sendUser(page, U(1));
  await sendUser(page, U(2));
  await sendUser(page, U(3));
  await sendUser(page, U(4));

  // (1) au moins une sb_update "sessions" contient ended_at.
  await expect
    .poll(() => records.filter(isSessionsEndedAt).length, { timeout: 10_000 })
    .toBeGreaterThan(0);

  // (2) aucune requête "cartes" ne contient ended_at.
  expect(anyCartesHasEndedAt(records)).toBe(false);
  // (3) aucune requête status:"abandoned" ne contient ended_at.
  expect(anyAbandonHasEndedAt(records)).toBe(false);
});

// ── Scénario C — progression 5 temps + clôture ────────────────────────────
test("C — 5 temps validés, clôture propre, carte sans ended_at", async ({
  page,
}) => {
  const records = await setupEngine(page);
  await gotoChat(page);
  await startSession(page);

  // Chaque message user débloque un temps ; on valide la carte à chaque fois.
  for (let i = 1; i <= 5; i++) {
    await sendUser(page, U(i));
    await validatePending(page);
  }

  // 5e validé ⇒ phase de clôture (awaiting-reply). Dernière parole de la
  // personne ⇒ miroir, puis génération de la carte en arrière-plan.
  await sendUser(page, U(6));

  // Clôture : "Voir ma carte" (pied de page) → sceau → "Voir ma carte" (overlay).
  const voirCarte = page.getByRole("button", { name: "Voir ma carte" });
  await voirCarte.first().waitFor({ state: "visible", timeout: 20_000 });
  await voirCarte.first().click();
  // L'overlay de sceau ajoute un second bouton "Voir ma carte" (skipSeal).
  await expect(voirCarte).toHaveCount(2, { timeout: 20_000 });
  await voirCarte.last().click();

  // (1) écran de fin atteint.
  await page
    .getByText("Il y a eu une clairière ici.", { exact: false })
    .waitFor({ state: "visible", timeout: 20_000 });

  // (2) un insert "cartes" SANS ended_at.
  const cartesInserts = records.filter(isCartesInsert);
  expect(cartesInserts.length).toBeGreaterThan(0);
  for (const c of cartesInserts) {
    expect(c.payload?.ended_at == null).toBe(true);
  }

  // (3) le ended_at de session vient d'une sb_update "sessions", pas de l'insert
  //     carte.
  expect(records.filter(isSessionsEndedAt).length).toBeGreaterThan(0);
  expect(anyCartesHasEndedAt(records)).toBe(false);

  // (4) AUCUNE requête status:"abandoned" (clôture propre ≠ abandon).
  expect(records.some((r: WorkerRequest) => r.payload?.status === "abandoned")).toBe(
    false,
  );
});
