import { describe, expect, it } from "vitest";
import { calibration, cbmFlag, cbmMarks } from "@/lib/cbm";
import { applyExamOutcome, examRating } from "@/lib/exam-fsrs";
import { isRedrillDue, redrillSchedule, shouldLog } from "@/lib/error-log";
import { addTime, blank, currentId, init, isAnswered, needsNudge, next, progress, select, setCertainty, setTrap, toggleFlag, toggleStrike } from "@/lib/exam-state";
import { review } from "@/lib/fsrs";

const T0 = new Date("2026-02-01T00:00:00Z");

describe("certainty-based marking", () => {
  it("uses the 1/2/3 vs 0/-2/-6 mark scheme", () => {
    expect([1, 2, 3].map((c) => cbmMarks(true, c as 1 | 2 | 3))).toEqual([1, 2, 3]);
    expect([1, 2, 3].map((c) => cbmMarks(false, c as 1 | 2 | 3))).toEqual([0, -2, -6]);
  });
  it("flags dangerous misconceptions and lucky guesses only", () => {
    expect(cbmFlag(false, 3)).toBe("dangerous_misconception");
    expect(cbmFlag(true, 1)).toBe("lucky_guess");
    expect(cbmFlag(true, 3)).toBeNull();
    expect(cbmFlag(false, 1)).toBeNull();
  });
  it("builds a calibration matrix with overconfidence", () => {
    const cal = calibration([
      { correct: false, certainty: 3 }, { correct: false, certainty: 3 }, { correct: true, certainty: 3 },
      { correct: true, certainty: 1 }, { correct: false, certainty: 1 },
    ]);
    const c3 = cal.rows.find((r) => r.certainty === 3)!;
    expect(c3).toMatchObject({ n: 3, correct: 1 });
    expect(c3.gap).toBeLessThan(0); // overconfident at C3
    expect(cal.overconfidence).toBeGreaterThan(0);
    expect(cal.marks).toBe(-6 - 6 + 3 + 1 + 0);
    expect(cal.maxMarks).toBe(15);
  });
  it("handles an empty block", () => {
    expect(calibration([]).overconfidence).toBe(0);
  });
});

describe("exam -> FSRS overrides", () => {
  const seasoned = review(review(review(null, 3, T0), 3, new Date("2026-02-02T00:00:00Z")), 3, new Date("2026-02-06T00:00:00Z"));
  const later = new Date("2026-03-01T00:00:00Z");
  it("maps outcomes to ratings", () => {
    expect(examRating(false, 3, 1000)).toBe(1);
    expect(examRating(true, 1, 1000)).toBe(2);
    expect(examRating(true, 2, 1000)).toBe(3);
    expect(examRating(true, 3, 10_000)).toBe(4);
    expect(examRating(true, 3, 80_000)).toBe(3);
  });
  it("dangerous misconception resets stability and re-drills within minutes", () => {
    const r = applyExamOutcome(seasoned, false, 3, 20_000, later);
    expect(r.stability).toBeLessThanOrEqual(0.5);
    expect(r.state).toBe(3);
    expect(r.due.getTime() - later.getTime()).toBe(10 * 60_000);
  });
  it("lucky guess stays in short-term rotation", () => {
    const r = applyExamOutcome(seasoned, true, 1, 20_000, later);
    expect(r.stability).toBeLessThanOrEqual(1);
    expect(r.due.getTime() - later.getTime()).toBeLessThanOrEqual(24 * 3_600_000);
  });
  it("a confident correct answer is not overridden", () => {
    const r = applyExamOutcome(seasoned, true, 3, 20_000, later);
    expect(r.stability).toBeGreaterThan(seasoned.stability);
  });
});

describe("mistake journal", () => {
  it("logs misses and low-certainty answers only", () => {
    expect(shouldLog(false, 2)).toBe(true);
    expect(shouldLog(true, 1)).toBe(true);
    expect(shouldLog(true, 2)).toBe(false);
  });
  it("schedules Day 1/3/7 and tracks what is due", () => {
    const s = redrillSchedule(T0);
    expect(s.map((x) => (new Date(x).getTime() - T0.getTime()) / 86_400_000)).toEqual([1, 3, 7]);
    expect(isRedrillDue(s, null, new Date("2026-02-01T12:00:00Z"))).toBe(false);
    expect(isRedrillDue(s, null, new Date("2026-02-02T01:00:00Z"))).toBe(true);
    expect(isRedrillDue(s, new Date("2026-02-02T02:00:00Z"), new Date("2026-02-02T03:00:00Z"))).toBe(false); // already retested
    expect(isRedrillDue(s, new Date("2026-02-02T02:00:00Z"), new Date("2026-02-05T00:00:00Z"))).toBe(true); // Day 3 due
  });
});

describe("exam state machine", () => {
  it("strike-through and selection are mutually exclusive", () => {
    let s = init(["a"]);
    s = select(s, "a", 2);
    s = toggleStrike(s, "a", 2);
    expect(s.answers.a.choice).toBeNull();
    expect(s.answers.a.eliminated).toEqual([2]);
    s = select(s, "a", 2);
    expect(s.answers.a.eliminated).toEqual([]);
  });
  it("trap tags clear when an option is un-struck", () => {
    let s = init(["a"]);
    s = toggleStrike(s, "a", 1);
    s = setTrap(s, "a", 1, "extreme_wording");
    expect(s.answers.a.trap[1]).toBe("extreme_wording");
    s = toggleStrike(s, "a", 1);
    expect(s.answers.a.trap[1]).toBeUndefined();
  });
  it("requires both a choice and a certainty", () => {
    let s = init(["a"]);
    s = select(s, "a", 0);
    expect(isAnswered(s.answers.a)).toBe(false);
    s = setCertainty(s, "a", 2);
    expect(isAnswered(s.answers.a)).toBe(true);
    expect(progress(s)).toEqual({ answered: 1, flagged: 0, total: 1 });
  });
  it("nudges at 90s", () => {
    expect(needsNudge(89_999)).toBe(false);
    expect(needsNudge(90_000)).toBe(true);
    expect(addTime(init(["a"]), "a", 5000).answers.a.ms).toBe(5000);
  });
  it("two-pass: flagged items come back in pass 2, then finish", () => {
    let s = init(["a", "b", "c"]);
    s = toggleFlag(s, "b");
    let r = next(s); s = r.state; expect(currentId(s)).toBe("b");
    r = next(s); s = r.state; expect(currentId(s)).toBe("c");
    r = next(s); s = r.state;
    expect(r.done).toBe(false);
    expect(s.pass).toBe(2);
    expect(currentId(s)).toBe("b");
    expect(next(s).done).toBe(true);
  });
  it("finishes straight after pass 1 when nothing is flagged", () => {
    const s = { ...init(["a"]) };
    expect(next(s).done).toBe(true);
    expect(blank().flagged).toBe(false);
  });
});
