import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * OpenNext's edge converter does `import cookieParser from "cookie"` (a default import).
 * cookie@1.x has no default export, so any request with a Cookie header threw
 * "Cannot read properties of undefined (reading 'parse')" on Workers (Error 1101).
 * package.json pins cookie@0.7.x for @opennextjs/aws via a pnpm override.
 */
describe("OpenNext cookie dependency", () => {
  it("gives @opennextjs/aws a cookie version that has a default export", () => {
    const store = join(process.cwd(), "node_modules/.pnpm");
    const dirs = readdirSync(store).filter((d) => d.startsWith("@opennextjs+aws@"));
    expect(dirs.length).toBeGreaterThan(0);
    for (const d of dirs) {
      const pkgPath = join(store, d, "node_modules/cookie/package.json");
      expect(existsSync(pkgPath)).toBe(true);
      expect(JSON.parse(readFileSync(pkgPath, "utf8")).version.startsWith("0.")).toBe(true);
    }
  });
});
