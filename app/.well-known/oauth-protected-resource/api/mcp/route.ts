/** RFC 9728 protected-resource metadata: tells MCP clients that Clerk is the authorization server for /api/mcp. */
export const dynamic = "force-dynamic";

function issuer() {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY ?? "";
  const host = atob(pk.split("_").slice(2).join("_")).replace(/\$$/, "");
  return `https://${host}`;
}

export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return Response.json(
    { resource: `${origin}/api/mcp`, authorization_servers: [issuer()], bearer_methods_supported: ["header"], resource_name: "Musubi" },
    { headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" } },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" } });
}
