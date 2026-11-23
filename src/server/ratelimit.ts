import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type Bucket = "api" | "mcp" | "community" | "heavy";
const CONFIG: Record<Bucket, { n: number; window: `${number} ${"s" | "m"}` }> = {
  api: { n: 60, window: "1 m" },
  mcp: { n: 30, window: "1 m" },
  community: { n: 20, window: "5 m" },
  heavy: { n: 10, window: "5 m" }, // uploads + exports
};

/** Fixed-config sliding-window limiter. Fails open (with ok:true, limited:false) when Upstash isn't configured or errors. */
export async function limit(bucket: Bucket, key: string): Promise<{ ok: boolean; reset?: number; remaining?: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { ok: true };
  try {
    const { n, window } = CONFIG[bucket];
    const rl = new Ratelimit({ redis: new Redis({ url, token }), limiter: Ratelimit.slidingWindow(n, window), prefix: `musubi:${bucket}` });
    const r = await rl.limit(key);
    return { ok: r.success, reset: r.reset, remaining: r.remaining };
  } catch (e) {
    console.error("ratelimit error", e);
    return { ok: true };
  }
}
