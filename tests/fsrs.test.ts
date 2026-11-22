import { describe, expect, it } from "vitest";
import { clampRetention, formatInterval, previews, retrievability, review, rowToCard } from "@/lib/fsrs";
import { bucketCounts, leitnerBucket } from "@/lib/leitner";

const T0 = new Date("2026-01-01T00:00:00Z");

describe("FSRS scheduling", () => {
  it("previews four ratings with non-decreasing intervals for a new card", () => {
    const p = previews(null, T0);
    expect(p.map((x) => x.rating)).toEqual([1, 2, 3, 4]);
    for (let i = 1; i < 4; i++) expect(p[i].due.getTime()).toBeGreaterThanOrEqual(p[i - 1].due.getTime());
    expect(p[3].interval).toMatch(/d$/); // Easy graduates to days
  });
  it("is deterministic (fuzz off) and the stored state matches the preview", () => {
    const row = review(null, 4, T0);
    expect(row.due.getTime()).toBe(previews(null, T0)[3].due.getTime());
    expect(review(null, 4, T0)).toEqual(row);
  });
  it("Again after review adds a lapse and shrinks stability", () => {
    const good = review(review(null, 4, T0), 3, new Date("2026-01-09T00:00:00Z"));
    const lapsed = review(good, 1, new Date("2026-01-30T00:00:00Z"));
    expect(lapsed.lapses).toBe(good.lapses + 1);
    expect(lapsed.stability).toBeLessThan(good.stability);
  });
  it("higher target retention schedules sooner", () => {
    const base = review(review(null, 3, T0), 3, new Date("2026-01-02T00:00:00Z"));
    const at = (r: number) => previews(base, new Date("2026-02-01T00:00:00Z"), r)[2].due.getTime();
    expect(at(0.95)).toBeLessThanOrEqual(at(0.8));
  });
  it("retrievability decays over time and is 0 for unseen cards", () => {
    const row = review(null, 3, T0);
    expect(retrievability(null, T0)).toBe(0);
    const early = retrievability(row, new Date("2026-01-02T00:00:00Z"));
    const late = retrievability(row, new Date("2026-03-01T00:00:00Z"));
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0);
  });
  it("rowToCard treats an untouched row as a new card", () => {
    expect(rowToCard(null, T0).reps).toBe(0);
  });
  it("clamps retention to a sane range", () => {
    expect(clampRetention(0.1)).toBe(0.7);
    expect(clampRetention(1)).toBe(0.97);
    expect(clampRetention(undefined)).toBe(0.9);
  });
  it("formats intervals", () => {
    expect(formatInterval(T0, new Date(T0.getTime() + 30_000))).toBe("30s");
    expect(formatInterval(T0, new Date(T0.getTime() + 10 * 60_000))).toBe("10m");
    expect(formatInterval(T0, new Date(T0.getTime() + 3 * 86_400_000))).toBe("3d");
  });
});

describe("Leitner buckets", () => {
  it("climbs New -> Learning -> Consolidating -> Board-Ready by stability", () => {
    const base = review(review(null, 3, T0), 3, new Date("2026-01-02T00:00:00Z"));
    expect(leitnerBucket(null)).toBe("new");
    expect(leitnerBucket({ ...base, state: 2, stability: 3 })).toBe("learning");
    expect(leitnerBucket({ ...base, state: 2, stability: 10 })).toBe("consolidating");
    expect(leitnerBucket({ ...base, state: 2, stability: 40 })).toBe("board_ready");
    expect(leitnerBucket({ ...base, state: 3, stability: 40 })).toBe("learning"); // relearning
  });
  it("counts buckets", () => {
    expect(bucketCounts([null, null])).toEqual({ new: 2, learning: 0, consolidating: 0, board_ready: 0 });
  });
});
