import { toast } from "sonner";
const WORKER_URL = "/api/worker";

export async function sbGet(table: string, params: string = "", password?: string) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "sb_read",
      data: { table, params, password }
    })
  });
  if (!res.ok) { 
    if (res.status === 401) {
      toast.error("Non autorisé (Accès admin requis ou clé manquante)");
      throw new Error("Unauthorized");
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
    body: JSON.stringify({ type: "sb_insert", data: { table, payload, password } })
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
    body: JSON.stringify({ type: "sb_update", data: { table, id, payload, password } })
  });
  if (!res.ok) {
    toast.error(`Erreur réseau (${res.status}) lors de la mise à jour`);
    throw new Error("Worker request failed");
  }
  return res.json();
}
