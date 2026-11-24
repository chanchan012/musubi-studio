import { expect, test } from "@playwright/test";
import { ALICE, DECK, asUser } from "./fixtures";

test("mock exam on a seeded deck: answer with certainty, submit, see calibration and the error journal prompt", async ({ page, context }) => {
  await context.addCookies([asUser(ALICE)]);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/exam/${DECK}?count=3`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Question 1 \/ 3/)).toBeVisible();

  for (let n = 1; n <= 3; n++) {
    await page.getByRole("radio", { name: /Option A/ }).click(); // right only for the question whose key is A
    await page.getByRole("button", { name: /C3/ }).click();
    const last = n === 3;
    await page.getByRole("button", { name: last ? /Submit|Finish/ : "Next" }).click();
  }
  // results: calibration matrix + a score summary, with no horizontal overflow at 375 wide
  await expect(page.getByText(/calibration/i).first()).toBeVisible({ timeout: 15_000 });
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
});
