import { expect, test, type Page } from "@playwright/test";
import { VIEWPORTS } from "../playwright.config";

const prev = [1, 2, 3, 4].map((r) => ({ rating: r, label: ["Again", "Hard", "Good", "Easy"][r - 1], interval: ["1m", "6m", "10m", "4d"][r - 1] }));
const card = (id: string, front: string, back: string) => ({ id, kind: "card", front, back, cloze: null, mnemonic: null, pearl: "Pearl text", diagramKey: null, compareTable: { headers: ["A", "B"], rows: [["1", "2"]] }, stem: null, options: null, answerIdx: null, rationales: null, blueprint: "Cardio", previews: prev });

async function mock(page: Page) {
  const reviews: unknown[] = [];
  await page.route("**/api/study/queue**", (r) => r.fulfill({ json: { queue: [card("11111111-1111-4111-8111-111111111111", "What inhibits COX?", "Aspirin and NSAIDs reduce prostaglandin synthesis"), card("22222222-2222-4222-8222-222222222222", "Second front", "Second back")] } }));
  await page.route("**/api/study/stats**", (r) => r.fulfill({ json: { total: 2, due: 2, buckets: { new: 2, learning: 0, consolidating: 0, board_ready: 0 } } }));
  await page.route("**/api/study/review", async (r) => { reviews.push(r.request().postDataJSON()); await r.fulfill({ json: { previews: prev, feynmanPrompt: false } }); });
  return reviews;
}

for (const [name, size] of Object.entries(VIEWPORTS)) {
  test.describe(`${name} study`, () => {
    test.use({ viewport: size });

    test("flip, rate with keyboard, finish; no overflow", async ({ page }) => {
      const reviews = await mock(page);
      await page.goto("/e2e/study", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("prompt")).toHaveText("What inhibits COX?");
      await page.keyboard.press("Space");
      await expect(page.getByTestId("answer")).toContainText("prostaglandin");
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(sw).toBeLessThanOrEqual(cw);
      await page.keyboard.press("3");
      await expect(page.getByTestId("prompt")).toHaveText("Second front");
      await page.getByRole("button", { name: /Show answer/ }).click();
      await page.getByRole("button", { name: /Easy/ }).click();
      await expect(page.getByText("Nice. Queue clear.")).toBeVisible();
      expect(reviews).toEqual([{ itemId: "11111111-1111-4111-8111-111111111111", rating: 3 }, { itemId: "22222222-2222-4222-8222-222222222222", rating: 4 }]);
    });

    test("blurt scores key terms and suggests a rating", async ({ page }) => {
      await mock(page);
      await page.goto("/e2e/study", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Blurt" }).click();
      await page.getByLabel("Write everything you remember").fill("aspirin reduces prostaglandin synthesis");
      await page.getByRole("button", { name: /Check my answer/ }).click();
      await expect(page.getByText(/You recalled/)).toContainText("Suggested");
    });

    test("dual coding shows the comparison table", async ({ page }) => {
      await mock(page);
      await page.goto("/e2e/study", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Dual coding" }).click();
      await expect(page.getByRole("table")).toBeVisible();
    });
  });
}
