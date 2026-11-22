import { expect, test } from "@playwright/test";
import { VIEWPORTS } from "../playwright.config";

for (const [name, size] of Object.entries(VIEWPORTS)) {
  test.describe(`${name} ${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    for (const path of ["/", "/sign-in", "/sign-up"]) {
      test(`${path} has no horizontal overflow`, async ({ page }) => {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(300);
        const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        expect(sw).toBeLessThanOrEqual(cw);
      });
    }

    test("auth pages fit a single viewport (no vertical scroll)", async ({ page }) => {
      for (const path of ["/sign-in", "/sign-up"]) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        const { sh, ch } = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
        expect(sh).toBeLessThanOrEqual(ch);
      }
    });

    test("landing sandbox exam: strike, certainty, submit, calibration", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const demo = page.locator("#try");
      await expect(demo.getByText("Question 1 / 2")).toBeVisible();

      // Q1: eliminate A (and tag it), choose B (correct), certainty C3 -> correct + sure
      await demo.getByRole("button", { name: "Eliminate option A" }).click();
      await demo.getByRole("button", { name: "Extreme wording" }).first().click();
      await demo.getByRole("radio", { name: /Option B/ }).click();
      await expect(demo.getByRole("button", { name: "Next" })).toBeDisabled(); // certainty still required
      await demo.getByRole("button", { name: /C3/ }).click();
      await demo.getByRole("button", { name: "Next" }).click();

      // Q2: choose A (wrong) with C3 -> dangerous misconception
      await expect(demo.getByText("Question 2 / 2")).toBeVisible();
      await demo.getByRole("radio", { name: /Option A/ }).click();
      await demo.getByRole("button", { name: /C3/ }).click();
      await demo.getByRole("button", { name: "Submit exam" }).click();

      await expect(demo.getByTestId("score")).toContainText("1/2");
      await expect(demo.getByTestId("calibration")).toBeVisible();
      await expect(demo.getByText("Dangerous misconception")).toBeVisible();
      await expect(demo.getByText(/added to your Error Log/)).toBeVisible();
      await demo.getByRole("button", { name: "Knowledge gap" }).click();
      await expect(demo.getByRole("button", { name: "Knowledge gap" })).toHaveAttribute("aria-pressed", "true");

      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(sw).toBeLessThanOrEqual(cw);
    });
  });
}

test("keyboard: A–E choose, X strike, 1–3 certainty, F flag, Enter next, two-pass", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const demo = page.locator("#try");
  await expect(demo.getByTestId("stopwatch")).toHaveText("0:01"); // the timer only ticks once React has hydrated
  await page.keyboard.press("b");
  await expect(demo.getByRole("radio", { name: /Option B/ })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("x"); // strike the option under the cursor (B) -> clears the pick
  await expect(demo.getByRole("button", { name: "Eliminate option B" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("x");
  await page.keyboard.press("b");
  await page.keyboard.press("2");
  await page.keyboard.press("f");
  await expect(demo.getByText("Flagged for Pass 2")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(demo.getByText("Question 2 / 2")).toBeVisible();
  await page.keyboard.press("a");
  await page.keyboard.press("1");
  await page.keyboard.press("Enter"); // end of pass 1 -> flagged Q1 returns in pass 2
  await expect(demo.getByText("Pass 2", { exact: true })).toBeVisible();
  await expect(demo.getByText("Question 1 / 1")).toBeVisible();
});

test("90-second nudge appears and 'Mark & move' flags the question", async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const demo = page.locator("#try");
  await expect(demo.getByRole("status")).toHaveCount(0);
  await page.clock.fastForward(91_000);
  await expect(demo.getByRole("status")).toContainText("90 seconds");
  await demo.getByRole("status").getByRole("button", { name: /Mark/ }).click();
  await expect(demo.getByText("Question 2 / 2")).toBeVisible();
});
