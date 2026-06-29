import { useEffect, useRef, type MutableRefObject } from "react";

// Types repris VERBATIM du composant Chat (Role/Message locaux). Le hook ne lit
// des messages que `m.role === "user"`, mais on garde la forme réelle.
type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
  ts?: string;
}

type Deps = {
  sessionActive: boolean;
  showEnded: boolean;
  closingPhase: "none" | "awaiting-reply" | "closed";
  personalId: string;
  validatedSteps: Set<number>;
  messages: Message[];
  // L'objet ref (PAS .current) : l'effet de synchro lit currentSessionId.current
  // au moment du run, comme dans le composant. Ne figure donc pas dans les deps.
  currentSessionId: MutableRefObject<string | null>;
};

// ── Marquage des sessions abandonnées ─────────────────────
// Quand la fenêtre se ferme en pleine conversation (ni clôture propre, ni
// miroir), la ligne `sessions` resterait orpheline en base. On la marque
// `status: "abandoned"` via sendBeacon. On ne touche PAS `ended_at` : le
// plafond compte `ended_at=not.is.null`, donc une session abandonnée ne
// doit pas consommer de crédit quotidien.
// Un ref tient toujours le dernier état utile — le handler `pagehide` doit
// rester synchrone (sendBeacon est fire-and-forget), il n'attend rien.
export function useAbandonBeacon({
  sessionActive,
  showEnded,
  closingPhase,
  personalId,
  validatedSteps,
  messages,
  currentSessionId,
}: Deps) {
  const abandonRef = useRef<{
    sessionActive: boolean;
    showEnded: boolean;
    closingPhase: string;
    sessionId: string | null;
    personalId: string;
    stepCount: number;
    userMessageCount: number;
    code: string;
  }>({
    sessionActive: false,
    showEnded: false,
    closingPhase: "none",
    sessionId: null,
    personalId: "",
    stepCount: 0,
    userMessageCount: 0,
    code: "",
  });

  useEffect(() => {
    abandonRef.current = {
      sessionActive,
      showEnded,
      closingPhase,
      sessionId: currentSessionId.current,
      personalId,
      stepCount: validatedSteps.size,
      userMessageCount: messages.filter((m) => m.role === "user").length,
      code: localStorage.getItem("collegue_access_code") || "",
    };
  }, [
    sessionActive,
    showEnded,
    closingPhase,
    personalId,
    validatedSteps,
    messages,
  ]);

  useEffect(() => {
    const markAbandoned = () => {
      const s = abandonRef.current;
      // Rien à marquer si la session n'a jamais été insérée en base : pas de
      // sessionId, ou pas de personal_id (ex. plafond atteint avant l'insert).
      if (!s.sessionId || !s.personalId) return;
      // Ne pas re-marquer une session inactive ou déjà clôturée proprement.
      if (!s.sessionActive || s.showEnded || s.closingPhase === "closed")
        return;

      const payload = {
        type: "sb_update",
        data: {
          table: "sessions",
          id: s.sessionId,
          // code d'accès : le serveur exige un code valide pour toute écriture
          // scopée à un personal_id (verifyAccess). Capturé dans le ref pour
          // être disponible au moment synchrone du pagehide.
          code: s.code,
          // personal_id : borne la mise à jour côté serveur (sécurité).
          payload: {
            personal_id: s.personalId,
            status: "abandoned",
            step_reached: s.stepCount,
            user_message_count: s.userMessageCount,
          },
        },
      };
      // sendBeacon ne peut pas poser d'en-tête Content-Type : on type le Blob
      // pour qu'`express.json()` parse bien le corps côté serveur.
      try {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/worker", blob);
      } catch (e) {
        // Fire-and-forget : un échec ici ne doit jamais gêner la fermeture.
      }
    };

    // `pagehide` se déclenche aussi sur mobile (onglet tué, mise en
    // arrière-plan), contrairement à `beforeunload`.
    window.addEventListener("pagehide", markAbandoned);
    return () => window.removeEventListener("pagehide", markAbandoned);
  }, []);
}
