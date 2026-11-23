/** R2 through the Worker binding (no S3 credentials, no network signing). Lazy import: `cloudflare:` modules don't exist in Node tests. */
type Bucket = {
  put(key: string, value: string, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  head(key: string): Promise<unknown | null>;
};

export async function bucket(): Promise<Bucket> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const b = (getCloudflareContext().env as { R2?: Bucket }).R2;
  if (!b) throw new Error("R2 binding is not configured");
  return b;
}

export async function putText(key: string, body: string, contentType: string) {
  await (await bucket()).put(key, body, { httpMetadata: { contentType } });
}

export async function exists(key: string) {
  return (await (await bucket()).head(key)) !== null;
}
