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
    if (res.status === 401) {
      toast.error("Non autorisé (Accès admin requis ou clé manquante)");
      throw new Error("Unauthorized");
    }
    // 400 "invalid" = clé réclamée mais code absent/incorrect en local sur cet
    // appareil. On invite à se reconnecter avec le code plutôt que d'afficher
    // une erreur réseau opaque. (Un nouvel utilisateur non réclamé ne déclenche
    // jamais ce 400 : sa lecture passe via la règle « allow-if-unclaimed ».)
    let errBody: any = null;
    try { errBody = await res.json(); } catch {}
    if (res.status === 400 && errBody && errBody.error === "invalid") {
      window.dispatchEvent(new CustomEvent("collegue:code-required"));
      toast.error("Entre ton code pour accéder à ton carnet sur cet appareil.");
      throw new Error("CodeRequired");
    }
    toast.error(`Erreur réseau (${res.status}) lors de la lecture`);
    throw new Error("Worker request failed");
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
    toast.error(`Erreur réseau (${res.status}) lors de la sauvegarde`);
    throw new Error("Worker request failed");
  }
  return res.json();
}

export async function sbUpdate(table: string, id: string, payload: any, password?: string) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "sb_update", data: { table, id, payload, password, code: accessCode() } })
  });
  if (!res.ok) {
    toast.error(`Erreur réseau (${res.status}) lors de la mise à jour`);
    throw new Error("Worker request failed");
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