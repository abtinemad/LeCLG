import type { Target } from "../lib/harness";
import carnetTarget from "./carnet";
import chatTargets from "./chat";

// Registry of all targets the harness photographs. Add a new entry here (e.g. a
// future chat.ts) to extend coverage to another page split — the spec and the
// orchestrator pick everything up automatically.
//
// Chat is split into several targets (one per seeded state) because /chat is
// fully determined by a single localStorage blob that the harness re-seeds on
// every navigation — see ./chat.ts for the rationale.
export const TARGETS: Target[] = [carnetTarget, ...chatTargets];
