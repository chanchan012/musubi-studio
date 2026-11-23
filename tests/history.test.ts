import { describe, expect, it } from "vitest";
import { canRedo, canUndo, emptyHistory, MAX_HISTORY, push, redo, undo, type Command } from "@/lib/history";
import { critiqueDistractors, mcqInput } from "@/lib/item-schemas";

const cmd = (id: string, kind: "human" | "ai"): Command<string> => ({
  id, label: id, actor: { kind, name: kind === "ai" ? "claude" : "me" }, at: 0, forward: "f" + id, inverse: "i" + id,
});

describe("history", () => {
  it("undo pops the latest human command and skips AI edits", () => {
    let h = emptyHistory<string>();
    h = push(h, cmd("a", "human"));
    h = push(h, cmd("b", "ai"));
    const r = undo(h);
    expect(r.cmd?.id).toBe("a");
    expect(r.history.past.map((c) => c.id)).toEqual(["b"]);
    expect(canUndo(r.history)).toBe(false);
    expect(canUndo(r.history, "ai")).toBe(true);
  });
  it("redo restores, and a new push clears redo", () => {
    let h = push(emptyHistory<string>(), cmd("a", "human"));
    h = undo(h).history;
    expect(canRedo(h)).toBe(true);
    const r = redo(h);
    expect(r.cmd?.id).toBe("a");
    expect(push(h, cmd("c", "human")).future).toEqual([]);
  });
  it("caps history", () => {
    let h = emptyHistory<string>();
    for (let i = 0; i < MAX_HISTORY + 20; i++) h = push(h, cmd(String(i), "human"));
    expect(h.past).toHaveLength(MAX_HISTORY);
  });
  it("undo on empty is a no-op", () => expect(undo(emptyHistory()).cmd).toBeNull());
});

describe("mcq schema + critique", () => {
  const base = { stem: "s", options: ["aaaa", "bbbb", "cccc", "dddd"], answerIdx: 1, keyRationale: "k", optionRationales: ["1", "2", "3", "4"] };
  it("accepts valid and rejects mismatched rationales", () => {
    expect(mcqInput.safeParse(base).success).toBe(true);
    expect(mcqInput.safeParse({ ...base, optionRationales: ["1", "2", "3"] }).success).toBe(false);
    expect(mcqInput.safeParse({ ...base, options: ["a", "b", "c"] }).success).toBe(false);
  });
  it("flags all-of-the-above and length cues", () => {
    const n = critiqueDistractors({ options: ["x", "All of the above", "a much much longer correct answer here", "y"], answerIdx: 2 });
    expect(n.some((x) => x.issue.includes("all/none"))).toBe(true);
    expect(n.some((x) => x.issue.includes("longest"))).toBe(true);
  });
});
