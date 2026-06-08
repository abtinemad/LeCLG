import { toast } from "sonner";
const WORKER_URL = "/api/worker";

// Code d'accès à 6 chiffres, joint à chaque requête utilisateur pour que le
// serveur puisse vérifier le couple (clé, code). Vide si non connecté.
function accessCode(): string {
  try {
    return localStorage.getItem("collegue_access_code") || "";
  } catch {
    return "";
  }
}

// Identifiant porteur de la personne (dérivé de la passphrase), joint aux
// écritures pour qu'elles restent scopées à sa propre ligne. Le serveur refuse
// désormais un update non-admin sans personal_id. Vide si non connecté.
function accessPersonalId(): string {
  try {
    return localStorage.getItem("collegue_personal_id") || "";
  } catch {
    return "";
  }
}

// Gestion commune des échecs d'auth (clé réclamée) pour lecture ET écriture.
// 400 "invalid" = code absent/incorrect en local sur cet appareil → on invite
// à entrer le code. 423 = verrou anti-brute-force. 401 = non autorisé.
// Renvoie true si l'erreur a été traitée (et relancée), false sinon.
async function handleAuthError(res: Response, action: string): Promise<void> {
  if (res.status === 401) {
    toast.error("Non autorisé (Accès admin requis ou clé manquante)");
    throw new Error("Unauthorized");
  }
  if (res.status === 423) {
    toast.error("Trop d'essais de code. Réessaie dans quelques minutes.");
    throw new Error("Locked");
  }
  let errBody: any = null;
  try { errBody = await res.json(); } catch {}
  if (res.status === 400 && errBody && errBody.error === "invalid") {
    window.dispatchEvent(new CustomEvent("collegue:code-required"));
    toast.error("Entre ton code pour accéder à ton carnet sur cet appareil.");
    throw new Error("CodeRequired");
  }
  toast.error(`Erreur réseau (${res.status}) lors de ${action}`);
  throw new Error("Worker request failed");
}

export async function sbGet(table: string, params: string = "", password?: string) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "sb_read",
      data: { table, params, password, code: accessCode() }
    })
  });
  if (!res.ok) {
    // (Un nouvel utilisateur non réclamé ne déclenche jamais ce 400 : sa
    // lecture renvoie [] via la règle « unknown → vide ».)
    await handleAuthError(res, "la lecture");
  }
  return res.json();
}

export async function sbInsert(table: string, payload: any, password?: string) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "sb_insert", data: { table, payload, password, code: accessCode() } })
  });
  if (!res.ok) {
    await handleAuthError(res, "la sauvegarde");
  }
  return res.json();
}

export async function sbUpdate(table: string, id: string, payload: any, password?: string) {
  // Scoping : on injecte le personal_id porteur dans le payload pour tout
  // update utilisateur — pas pour les actes admin (qui passent un password et
  // agissent sur la ligne d'autrui). Le serveur lit personal_id dans le payload
  // pour borner le PATCH ; sans lui, il refuse (401). On n'écrase jamais un
  // personal_id déjà présent.
  const pid = accessPersonalId();
  const scopedPayload =
    !password && pid && (payload == null || payload.personal_id == null)
      ? { ...payload, personal_id: pid }
      : payload;
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "sb_update", data: { table, id, payload: scopedPayload, password, code: accessCode() } })
  });
  if (!res.ok) {
    await handleAuthError(res, "la mise à jour");
  }
  return res.json();
}

// La personne ajoute une réponse à son propre Éclat. Passe par le handler
// serveur dédié eclat_reply — jamais par sb_update, verrouillé admin.
export async function sendEclatReply(eclatId: string, personalId: string, text: string) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "eclat_reply",
      data: { eclat_id: eclatId, personal_id: personalId, text, code: accessCode() },
    }),
  });
  if (!res.ok) {
    toast.error(`Erreur réseau (${res.status}) lors de l'envoi`);
    throw new Error("Worker request failed");
  }
  return res.json();
}