import { Hono } from "hono";
import { createClerkClient } from "@clerk/backend";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildMcpServer } from "../mcp";
import { verifyToken } from "../mcp-tokens";
import { limit } from "../ratelimit";

export const mcp = new Hono();

/** Public URL of the MCP resource, e.g. https://host/api/mcp. This is the OAuth audience Clerk issues tokens for. */
export function resourceUrl(req: Request) {
  return `${new URL(req.url).origin}/api/mcp`;
}
export function metadataUrl(req: Request) {
  return `${new URL(req.url).origin}/.well-known/oauth-protected-resource/api/mcp`;
}

async function serve(req: Request, server: McpServer) {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

type Who = { userId: string; name: string; rateKey: string };

/** Clerk OAuth access token (audience = this MCP URL) first, then a personal `mus_` token as a fallback for headless agents. */
async function authed(req: Request): Promise<Who | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m) return null;
  const raw = m[1];
  if (raw.startsWith("mus_")) {
    const t = await verifyToken(raw);
    return t ? { userId: t.userId, name: t.name, rateKey: t.tokenId } : null;
  }
  try {
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY,
    });
    const result = await clerk.authenticateRequest(req, { acceptsToken: "oauth_token", audience: resourceUrl(req) });
    if (!result.isAuthenticated) return null;
    const auth = result.toAuth() as { userId?: string | null; clientId?: string | null };
    if (!auth.userId) return null;
    return { userId: auth.userId, name: `MCP client${auth.clientId ? ` ${auth.clientId.slice(0, 8)}` : ""}`, rateKey: `oauth:${auth.userId}` };
  } catch {
    return null;
  }
}

async function handle(req: Request) {
  const who = await authed(req);
  if (!who) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl(req)}"`,
      },
    });
  }
  const rl = await limit("mcp", who.rateKey);
  if (!rl.ok) return new Response(JSON.stringify({ error: "rate limited" }), { status: 429, headers: { "content-type": "application/json" } });
  return serve(req, buildMcpServer({ userId: who.userId, tokenName: who.name }));
}

/** The 8 tools over Streamable HTTP. /api/mcp and /api/mcp/direct are the same server. */
mcp.all("/", (c) => handle(c.req.raw));
mcp.all("/direct", (c) => handle(c.req.raw));
