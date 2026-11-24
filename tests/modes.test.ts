import { describe, expect, it } from "vitest";
import { interleave } from "@/lib/interleave";
import { flowtimeBreakMs, pomodoro, sessionVelocity } from "@/lib/focus";
import { clozeIndices, parseCloze, renderCloze } from "@/lib/cloze";
import { needsFeynman, scoreBlurt } from "@/lib/blurt";

describe("interleave", () => {
  const items = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, t: "A" })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `b${i}`, t: "B" })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, t: "C" })),
  ];
  it("keeps every item exactly once", () => {
    const out = interleave(items, (x) => x.t, 7);
    expect(out).toHaveLength(items.length);
    expect(new Set(out.map((x) => x.id)).size).toBe(items.length);
  });
  it("never repeats a topic back-to-back while others remain", () => {
    for (const seed of [1, 2, 3, 99]) {
      const out = interleave(items, (x) => x.t, seed);
      const firstNine = out.slice(0, 9); // while all three topics still have items
      for (let i = 1; i < firstNine.length; i++) expect(firstNine[i].t).not.toBe(firstNine[i - 1].t);
    }
  });
  it("is reproducible per seed", () => {
    expect(interleave(items, (x) => x.t, 5)).toEqual(interleave(items, (x) => x.t, 5));
  });
});

describe("focus timers", () => {
  it("25/5 pomodoro alternates focus and break", () => {
    expect(pomodoro("25/5", 0)).toEqual({ phase: "focus", remainingMs: 25 * 60_000, cycle: 0 });
    expect(pomodoro("25/5", 26 * 60_000)).toMatchObject({ phase: "break", remainingMs: 4 * 60_000, cycle: 0 });
    expect(pomodoro("25/5", 31 * 60_000)).toMatchObject({ phase: "focus", cycle: 1 });
  });
  it("50/10 pomodoro", () => {
    expect(pomodoro("50/10", 55 * 60_000)).toMatchObject({ phase: "break", remainingMs: 5 * 60_000 });
  });
  it("flowtime break is clamped to 5-15 min", () => {
    expect(flowtimeBreakMs(10 * 60_000)).toBe(5 * 60_000);
    expect(flowtimeBreakMs(120 * 60_000)).toBe(15 * 60_000);
  });
  it("session velocity", () => {
    expect(sessionVelocity([1, 3, 4, 3], 120_000)).toEqual({ reviews: 4, perMinute: 2, accuracy: 0.75 });
    expect(sessionVelocity([], 0).accuracy).toBe(0);
  });
});

describe("cloze", () => {
  const t = "The {{c1::mitochondria::organelle}} makes {{c2::ATP}}; {{c1::cristae}} fold inward.";
  it("parses spans and indices", () => {
    expect(parseCloze(t)).toHaveLength(3);
    expect(clozeIndices(t)).toEqual([1, 2]);
  });
  it("hides only the active deletion and honours hints", () => {
    expect(renderCloze(t, 1)).toBe("The [organelle] makes ATP; […] fold inward.");
    expect(renderCloze(t, 2)).toBe("The mitochondria makes […]; cristae fold inward.");
    expect(renderCloze(t, 1, true)).toBe("The mitochondria makes ATP; cristae fold inward.");
  });
});

describe("blurting + Feynman", () => {
  const ans = "Mitochondria generate ATP through oxidative phosphorylation across the inner membrane";
  it("scores coverage and suggests a rating", () => {
    const full = scoreBlurt("mitochondria generate ATP via oxidative phosphorylation, inner membrane", ans);
    expect(full.coverage).toBeGreaterThan(0.85);
    expect(full.suggested).toBe(4);
    const none = scoreBlurt("no idea", ans);
    expect(none.suggested).toBe(1);
    expect(none.missed).toContain("mitochondria");
  });
  it("prompts Feynman for struggled items", () => {
    expect(needsFeynman(1, 0)).toBe(true);
    expect(needsFeynman(2, 0)).toBe(true);
    expect(needsFeynman(3, 0)).toBe(false);
    expect(needsFeynman(3, 2)).toBe(true);
  });
});

import { blurtTarget, faceOf, type StudyItem } from "@/lib/study-card";
const base: StudyItem = { id: "1", kind: "card", front: null, back: null, cloze: null, mnemonic: null, pearl: null, diagramKey: null, compareTable: null, stem: null, options: null, answerIdx: null, rationales: null, blueprint: null };
describe("study card faces", () => {
  it("cloze hides the first deletion and reveals it on the back", () => {
    const f = faceOf({ ...base, cloze: "{{c1::Aspirin}} inhibits {{c2::COX-1}}" });
    expect(f.prompt).toBe("[…] inhibits COX-1");
    expect(f.answer).toBe("Aspirin inhibits COX-1");
  });
  it("mcq flips to the key with rationale", () => {
    const f = faceOf({ ...base, kind: "mcq", stem: "Q?", options: ["a", "b"], answerIdx: 1, rationales: { key: "because", options: [] } });
    expect(f.options).toEqual(["a", "b"]);
    expect(f.answer).toBe("B. b");
    expect(blurtTarget({ ...base, kind: "mcq", stem: "Q?", options: ["a", "b"], answerIdx: 1, rationales: { key: "because", options: [] } })).toContain("because");
  });
  it("plain card passes front/back and extras", () => {
    const f = faceOf({ ...base, front: "F", back: "B", pearl: "P", mnemonic: "M" });
    expect([f.prompt, f.answer, f.extra]).toEqual(["F", "B", ["P", "Mnemonic: M"]]);
  });
});
