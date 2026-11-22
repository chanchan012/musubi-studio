import { Hono } from "hono";

export const app = new Hono().basePath("/api");

app.get("/health", (c) =>
  c.json({ ok: true, service: "musubi", time: new Date().toISOString() }),
);

export type AppType = typeof app;
