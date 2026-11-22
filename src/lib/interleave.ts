/** Small seeded PRNG (mulberry32) so mixes are reproducible in tests and replays. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Interleaved practice mixer: shuffles within each topic, then draws round-robin
 * from the topic with the most remaining items while never repeating the previous
 * topic when another is available — defeating the massed single-topic illusion.
 */
export function interleave<T>(items: readonly T[], topicOf: (t: T) => string, seed = 1): T[] {
  const rand = rng(seed);
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const k = topicOf(it);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(it);
  }
  for (const [k, v] of buckets) buckets.set(k, shuffle(v, rand));
  const out: T[] = [];
  let prev: string | null = null;
  while (out.length < items.length) {
    const live = [...buckets.entries()].filter(([, v]) => v.length > 0);
    const pool = live.filter(([k]) => k !== prev);
    const candidates = pool.length ? pool : live;
    const max = Math.max(...candidates.map(([, v]) => v.length));
    const top = candidates.filter(([, v]) => v.length === max);
    const [key, list] = top[Math.floor(rand() * top.length)];
    out.push(list.pop()!);
    prev = key;
  }
  return out;
}
