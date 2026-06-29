export const API_BASE = "/api";
export const WORKER_URL = "/api/worker";

export const toWorkerMessages = (msgs: any[]) => {
  const formatted = msgs.map((m) => ({
    role: m.role,
    content:
      typeof m.content === "string" ? m.content : m.parts?.[0]?.text || "",
  }));

  // Claude requires strictly alternating roles, and MUST start with a 'user' message
  const merged: {role: string, content: string}[] = [];
  for (const msg of formatted) {
    if (merged.length === 0 && msg.role === "assistant") {
      merged.push({ role: "user", content: "(Début de l'échange)" });
    }

    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1].content += "\n\n" + msg.content;
    } else {
      merged.push({ role: msg.role, content: msg.content });
    }
  }
  return merged;
};
