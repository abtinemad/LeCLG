import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { sbUpdate } from "./worker";

// Types repris VERBATIM du composant Chat (Role/Message locaux).
type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
  ts?: string;
}

const ENGAGEMENT_MIN_USER_MESSAGES = 3;

type Deps = {
  currentSessionId: MutableRefObject<string | null>;
  personalId: string;
  messages: Message[];
  validatedSteps: Set<number>;
};

export function useSaveSession({
  currentSessionId,
  personalId,
  messages,
  validatedSteps,
}: Deps) {
  return useCallback(
    async (convo?: Message[]) => {
      if (!currentSessionId.current || !personalId) return;
      const list = convo ?? messages;
      const userMessages = list.filter((m) => m.role === "user").length;
      const payload: Record<string, unknown> = {
        step_reached: validatedSteps.size,
        validated_steps: Array.from(validatedSteps),
        user_message_count: userMessages,
      };
      if (userMessages > ENGAGEMENT_MIN_USER_MESSAGES) {
        payload.ended_at = new Date().toISOString();
      }
      try {
        await sbUpdate("sessions", currentSessionId.current, payload);
      } catch (e) {
        console.error("saveSession failed", e);
      }
    },
    [validatedSteps.size, personalId, messages],
  );
}
