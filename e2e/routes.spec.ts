import { expect, test } from "@playwright/test";
import { VIEWPORTS } from "../playwright.config";
import { ALICE, DECK, POST, asUser } from "./fixtures";

const ROUTES = ["/", "/sign-in", "/sign-up", "/community", `/community/${POST}`, "/dashboard", "/study", `/study/${DECK}`, `/exam/${DECK}`, `/studio/${DECK}`];

for (const [name, size] of Object.entries(VIEWPORTS)) {
  test.describe(`${name} ${size.width}x${size.height}: every route fits`, () => {
    test.use({ viewport: size });
    for (const path of ROUTES) {
      test(`${path}`, async ({ page, context }) => {
        await context.addCookies([asUser(ALICE)]);
        const res = await page.goto(path, { waitUntil: "domcontentloaded" });
        expect(res?.status(), "route should render").toBeLessThan(400);
        await page.waitForTimeout(500);
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
        expect(m.sw, "document horizontal overflow").toBeLessThanOrEqual(m.cw);
        expect(m.bw, "body horizontal overflow").toBeLessThanOrEqual(m.cw);
      });
    }
  });
}
