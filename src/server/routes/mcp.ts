import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildMcpServer } from "../mcp";
import { verifyToken } from "../mcp-tokens";
import { limit } from "../ratelimit";

export const mcp = new Hono();

async function serve(req: Request, server: McpServer) {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

async function authed(req: Request) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  const who = m ? await verifyToken(m[1]) : null;
  return who;
}

/** Plain 8-tool server: /api/mcp/direct */
mcp.all("/direct", async (c) => {
  const who = await authed(c.req.raw);
  if (!who) return c.json({ error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
  const rl = await limit("mcp", who.tokenId);
  if (!rl.ok) return c.json({ error: "rate limited" }, 429);
  return serve(c.req.raw, buildMcpServer({ userId: who.userId, tokenName: who.name }));
});

/** Code Mode: one `code` tool that runs agent-written JS against the 8 tools in a Worker-Loader sandbox. Falls back to direct tools without the binding. */
mcp.all("/", async (c) => {
  const who = await authed(c.req.raw);
  if (!who) return c.json({ error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
  const rl = await limit("mcp", who.tokenId);
  if (!rl.ok) return c.json({ error: "rate limited" }, 429);
  const upstream = buildMcpServer({ userId: who.userId, tokenName: who.name });
  // Lazy imports: these pull in `cloudflare:workers`, which only exists in workerd (not in Node tests).
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const loader = (getCloudflareContext().env as { LOADER?: unknown }).LOADER;
  if (!loader) return serve(c.req.raw, upstream);
  const { DynamicWorkerExecutor } = await import("@cloudflare/codemode");
  const { codeMcpServer } = await import("@cloudflare/codemode/mcp");
  const executor = new DynamicWorkerExecutor({ loader: loader as never, timeout: 30_000 });
  return serve(c.req.raw, await codeMcpServer({ server: upstream, executor }));
});
