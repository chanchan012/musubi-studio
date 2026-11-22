import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "audio/mpeg"] as const;

export function r2Client(env: Record<string, string | undefined> = process.env) {
  const { CLOUDFLARE_ACCOUNT_ID: acct, R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret } = env;
  if (!acct || !id || !secret) throw new Error("R2 credentials are not configured");
  return new S3Client({
    region: "auto",
    endpoint: `https://${acct}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: id, secretAccessKey: secret },
  });
}

/** Keys are always namespaced by deck so ACL checks can derive the deck from the key. */
export function assetKey(deckId: string, filename: string, rand = crypto.randomUUID()): string {
  const safe = filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+\./g, ".").replace(/^-+|-+$/g, "").slice(-80) || "file";
  return `decks/${deckId}/${rand}-${safe}`;
}

export function deckIdFromKey(key: string): string | null {
  const m = /^decks\/([0-9a-f-]{36})\//.exec(key);
  return m ? m[1] : null;
}

export async function presignPut(key: string, contentType: string, contentLength: number, env = process.env) {
  const bucket = env.R2_BUCKET_NAME ?? "musubi-assets";
  return getSignedUrl(
    r2Client(env),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: contentLength }),
    { expiresIn: 600 },
  );
}

export async function presignGet(key: string, env = process.env) {
  const bucket = env.R2_BUCKET_NAME ?? "musubi-assets";
  return getSignedUrl(r2Client(env), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 600 });
}
