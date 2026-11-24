import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ALICE, DECK, POST, asUser } from "./fixtures";

const ROUTES = ["/", "/sign-in", "/community", `/community/${POST}`, "/dashboard", "/study", `/study/${DECK}`, `/exam/${DECK}`, `/studio/${DECK}`];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe WCAG 2.1 AA (${scheme})`, () => {
    test.use({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
    for (const path of ROUTES) {
      test(path, async ({ page, context }) => {
        await context.addCookies([asUser(ALICE)]);
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(600);
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(bad.map((v) => `${v.id}: ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + n.html.slice(0, 160)).join(" | ")}`)).toEqual([]);
      });
    }
  });
}
