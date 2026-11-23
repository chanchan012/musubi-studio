import { describe, expect, it } from "vitest";
import { countsFromGroups, difficultyBand, distractorRates, isVerified, pValue, render, toAnkiTsv, toCsv } from "@/lib/analytics";

describe("item analytics", () => {
  it("p-value and bands", () => {
    expect(pValue(0, 0)).toBeNull();
    expect(pValue(3, 4)).toBe(0.75);
    expect(difficultyBand(0.1)).toBe("hard");
    expect(difficultyBand(0.5)).toBe("moderate");
    expect(difficultyBand(0.95)).toBe("easy");
    expect(difficultyBand(null)).toBe("untested");
  });
  it("flags distractors under 5% only with enough attempts, never the key", () => {
    const r = distractorRates([2, 70, 26, 2], 1, 100);
    expect(r.map((x) => x.nonFunctioning)).toEqual([true, false, false, true]);
    expect(distractorRates([0, 5, 0, 0], 1, 5).some((x) => x.nonFunctioning)).toBe(false);
    expect(distractorRates([0, 40, 0, 0], 0, 40)[0].nonFunctioning).toBe(false); // key
  });
  it("rebuilds counts, ignoring skips and out-of-range", () => {
    expect(countsFromGroups([{ choice: 0, n: 2 }, { choice: 2, n: 3 }, { choice: null, n: 9 }, { choice: 7, n: 1 }], 4)).toEqual([2, 0, 3, 0]);
  });
  it("verified needs usage, score and zero open errata", () => {
    expect(isVerified({ attempts: 30, score: 3, openErrata: 0 })).toBe(true);
    expect(isVerified({ attempts: 29, score: 3, openErrata: 0 })).toBe(false);
    expect(isVerified({ attempts: 30, score: 2, openErrata: 0 })).toBe(false);
    expect(isVerified({ attempts: 30, score: 3, openErrata: 1 })).toBe(false);
  });
  it("exports escape correctly", () => {
    const items = [{ kind: "mcq" as const, stem: 'Say "hi", ok', options: ["a", "b"], answerIdx: 1, rationaleKey: "line\nbreak" }];
    expect(toCsv(items)).toContain('"Say ""hi"", ok"');
    expect(toCsv(items)).toContain('"line\nbreak"');
    const tsv = toAnkiTsv([{ kind: "card", front: "f\tx", back: "b", blueprint: "Cardio vascular" }]);
    expect(tsv).toBe("f x\tb\tCardio_vascular\n");
    expect(JSON.parse(render("json", items)).items).toHaveLength(1);
  });
});
