import { Hono } from "hono";
import { clerk, requireUser, type Vars } from "./auth";
import { decks } from "./routes/decks";
import { uploads } from "./routes/uploads";
import { study } from "./routes/study";
import { exam } from "./routes/exam";
import { webhooks } from "./routes/webhooks";

export const app = new Hono<{ Variables: Vars }>().basePath("/api");

app.get("/health", (c) =>
  c.json({ ok: true, service: "musubi", time: new Date().toISOString() }),
);

// Webhooks authenticate by signature, not session.
app.route("/webhooks", webhooks);

// Everything below needs a Clerk session.
app.use("*", clerk);
app.get("/me", requireUser, (c) => c.json({ userId: c.var.userId }));
app.route("/decks", decks);
app.route("/uploads", uploads);
app.route("/study", study);
app.route("/exam", exam);

export type AppType = typeof app;
