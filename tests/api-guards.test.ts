import { beforeAll, describe, expect, it } from "vitest";

let app: typeof import("@/server/app").app;

beforeAll(async () => {
  process.env.CLERK_SECRET_KEY = "sk_test_dummy";
  process.env.CLERK_PUBLISHABLE_KEY = "pk_test_cGVyZmVjdC1raXdpLTU2NTUuY2xlcmsuYWNjb3VudHMuZGV2JA";
  delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  ({ app } = await import("@/server/app"));
});

describe("API guards", () => {
  it("health is public", async () => {
    expect((await app.request("/api/health")).status).toBe(200);
  });
  for (const [method, path] of [["GET", "/api/me"], ["GET", "/api/decks"], ["POST", "/api/decks"], ["POST", "/api/uploads/presign"], ["GET", "/api/uploads/url?key=x"]] as const) {
    it(`${method} ${path} requires auth`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
    });
  }
  it("clerk webhook is 503 when unconfigured", async () => {
    const res = await app.request("/api/webhooks/clerk", { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
  });
  it("clerk webhook rejects bad signatures", async () => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = "whsec_" + btoa("0123456789abcdef0123456789abcdef");
    const res = await app.request("/api/webhooks/clerk", { method: "POST", body: "{}", headers: { "svix-id": "x", "svix-timestamp": "1", "svix-signature": "v1,bad" } });
    expect(res.status).toBe(400);
  });
});
