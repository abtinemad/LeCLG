import type { Target } from "../lib/harness";
import carnetTarget from "./carnet";

// Registry of all targets the harness photographs. Add a new entry here (e.g. a
// future chat.ts) to extend coverage to another page split — the spec and the
// orchestrator pick everything up automatically.
export const TARGETS: Target[] = [carnetTarget];
