import { expect, test, type Browser } from "@playwright/test";
import { ALICE, BOB, DECK, asUser } from "./fixtures";

async function studio(browser: Browser, user: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([asUser(user)]);
  const page = await context.newPage();
  await page.goto(`/studio/${DECK}`, { waitUntil: "domcontentloaded" });
  return { context, page };
}

test.describe("studio API (HTTP only)", () => {
  test("liveblocks-auth: members get a token, outsiders are refused", async ({ playwright }) => {
    const mk = (user: string) => playwright.request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { cookie: `e2e_user=${user}` } });
    const [alice, nobody] = [await mk(ALICE), await mk("e2e_nobody")];
    const ok = await alice.post("/api/studio/liveblocks-auth", { data: { room: `deck:${DECK}` } });
    test.skip(ok.status() === 503, "LIVEBLOCKS_SECRET_KEY is not in .env.local (it only lives in the Worker secrets)");
    expect(ok.status(), await ok.text()).toBe(200);
    expect((await ok.json()).token).toBeTruthy();
    expect((await nobody.post("/api/studio/liveblocks-auth", { data: { room: `deck:${DECK}` } })).status()).toBe(403);
    expect((await alice.post("/api/studio/liveblocks-auth", { data: { room: "deck:not-a-uuid" } })).status()).toBe(400);
  });

  test("an editor can write items; a non-member cannot", async ({ playwright }) => {
    const mk = (user: string) => playwright.request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { cookie: `e2e_user=${user}` } });
    const [bob, nobody] = [await mk(BOB), await mk("e2e_nobody")];
    const made = await bob.post(`/api/studio/decks/${DECK}/items`, { data: { cards: [{ front: "API card", back: "ok" }] } });
    expect(made.status()).toBe(201);
    const id = (await made.json()).items[0].id;
    expect((await nobody.post(`/api/studio/decks/${DECK}/items`, { data: { cards: [{ front: "x", back: "y" }] } })).status()).toBe(403);
    expect((await bob.get(`/api/studio/decks/${DECK}/items`)).status()).toBe(200);
    expect((await bob.delete(`/api/studio/decks/${DECK}/items/${id}`)).status()).toBeLessThan(300);
  });
});

test("two clients: presence, and a change by one appears for the other", async ({ browser }) => {
  test.setTimeout(120_000);
  test.skip(!process.env.E2E_REALTIME, "Set E2E_REALTIME=1 on a machine that can open WebSockets to api.liveblocks.io");
  const a = await studio(browser, ALICE);
  const b = await studio(browser, BOB);
  try {
    // each sees the other come online
    await expect(a.page.getByLabel(/1 other collaborator online/)).toBeVisible({ timeout: 30_000 });
    await expect(b.page.getByLabel(/1 other collaborator online/)).toBeVisible({ timeout: 30_000 });

    // Bob adds a flashcard through the API as himself; Alice's list refreshes through the Liveblocks broadcast.
    const res = await b.context.request.post(`/api/studio/decks/${DECK}/items`, { data: { cards: [{ front: "Live sync card", back: "It arrived" }] } });
    expect(res.status()).toBe(201);
    await expect(a.page.getByRole("list", { name: "Items" }).getByText("Live sync card")).toBeVisible({ timeout: 20_000 });
  } finally {
    await a.context.close(); await b.context.close();
  }
});
