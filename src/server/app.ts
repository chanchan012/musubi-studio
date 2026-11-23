import { Hono } from "hono";
import { clerk, requireUser, type Vars } from "./auth";
import { decks } from "./routes/decks";
import { uploads } from "./routes/uploads";
import { study } from "./routes/study";
import { exam } from "./routes/exam";
import { webhooks } from "./routes/webhooks";
import { studio } from "./routes/studio";
import { mcp } from "./routes/mcp";
import { community } from "./routes/community";
import { exportsRoute } from "./routes/exports";
import { serve } from "inngest/hono";
import { buildInngest } from "@/inngest/functions";

export const app = new Hono<{ Variables: Vars }>().basePath("/api");

app.get("/health", (c) =>
  c.json({ ok: true, service: "musubi", time: new Date().toISOString() }),
);

// Webhooks authenticate by signature, not session.
app.route("/webhooks", webhooks);
// MCP authenticates with a personal bearer token (sha256 in mcp_tokens), not a Clerk session.
app.route("/mcp", mcp);

// Inngest authenticates with its signing key. Built per request because Workers env is request-scoped.
app.on(["GET", "POST", "PUT"], "/inngest", (c) => {
  const { inngest, functions } = buildInngest();
  return serve({ client: inngest, functions })(c);
});

// Everything below needs a Clerk session.
app.use("*", clerk);
app.get("/me", requireUser, (c) => c.json({ userId: c.var.userId }));
app.route("/decks", decks);
app.route("/uploads", uploads);
app.route("/study", study);
app.route("/exam", exam);
app.route("/studio", studio);
app.route("/community", community);
app.route("/exports", exportsRoute);

export type AppType = typeof app;
