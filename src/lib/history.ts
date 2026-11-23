/** Command-pattern undo/redo with Human/AI attribution. Pure; the studio store wires apply/revert to the API. */
export type Actor = { kind: "human" | "ai"; name: string };

export type Command<T = unknown> = {
  id: string;
  label: string;
  actor: Actor;
  at: number;
  /** Opaque payloads the host uses to apply / revert. */
  forward: T;
  inverse: T;
};

export type History<T = unknown> = { past: Command<T>[]; future: Command<T>[] };

export const MAX_HISTORY = 100;

export const emptyHistory = <T,>(): History<T> => ({ past: [], future: [] });

/** Record a new command; clears the redo stack. */
export function push<T>(h: History<T>, cmd: Command<T>): History<T> {
  const past = [...h.past, cmd];
  return { past: past.length > MAX_HISTORY ? past.slice(-MAX_HISTORY) : past, future: [] };
}

/** Undo the latest command made by `by` kind (default: the most recent human command). AI edits stay unless asked. */
export function undo<T>(h: History<T>, by: Actor["kind"] = "human"): { history: History<T>; cmd: Command<T> | null } {
  for (let i = h.past.length - 1; i >= 0; i--) {
    if (h.past[i].actor.kind === by) {
      const cmd = h.past[i];
      return { cmd, history: { past: h.past.filter((_, j) => j !== i), future: [cmd, ...h.future] } };
    }
  }
  return { history: h, cmd: null };
}

export function redo<T>(h: History<T>): { history: History<T>; cmd: Command<T> | null } {
  const [cmd, ...rest] = h.future;
  if (!cmd) return { history: h, cmd: null };
  return { cmd, history: { past: [...h.past, cmd], future: rest } };
}

export const canUndo = (h: History, by: Actor["kind"] = "human") => h.past.some((c) => c.actor.kind === by);
export const canRedo = (h: History) => h.future.length > 0;

export function describe(cmd: Command): string {
  return `${cmd.actor.kind === "ai" ? "AI" : "Human"} · ${cmd.actor.name}: ${cmd.label}`;
}
