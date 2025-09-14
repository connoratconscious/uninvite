// lib/store.ts
/**
 * Minimal blob storage helpers that work both locally and on Vercel.
 * We upload the generated image and a tiny JSON metadata file, then later
 * read them back via the absolute URLs returned by `list()`.
 *
 * Notes:
 * - We use `access: 'public'` so the signed URL/ACL step is avoided.
 * - We always write metadata so the original filename can be preserved.
 */

import { put, list } from '@vercel/blob';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

/** Guard early with a clear error if the token isn't configured. */
function requireBlobToken() {
  if (!BLOB_TOKEN) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not set. Add it in your Vercel project env vars and .env.local for local dev.'
    );
  }
  return BLOB_TOKEN as string;
}

function extFromMime(mime: string) {
  return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
}

/** Shape returned when reading an image back from Blob storage. */
export type StoredImageRecord = {
  data: Uint8Array;
  mime: string;
  originalName: string | null;
};

/**
 * Save image bytes (or just write metadata if bytes are already uploaded elsewhere).
 * - If `existingUrl` is provided, we only write metadata JSON.
 * - Otherwise we upload the image (public) + metadata (public).
 */
export async function saveImageToBlob(
  token: string,
  bytes: Uint8Array | null,
  mime: string,
  originalName?: string,
  existingUrl?: string
) {
  const blobToken = requireBlobToken();

  const ext = extFromMime(mime);
  const imgKey = `images/${token}.${ext}`;
  const metaKey = `images/${token}.json`;

  // Upload image only if we don't already have it somewhere else
  if (!existingUrl) {
    if (!bytes) throw new Error('saveImageToBlob: bytes were null with no existingUrl');

    // Normalize Uint8Array -> standalone ArrayBuffer (avoid SharedArrayBuffer issues)
    const ab: ArrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;

    await put(imgKey, new Blob([ab], { type: mime }), {
      access: 'public',
      contentType: mime,
      token: blobToken,
    });
  }

  // Always (re)write metadata (keep it tiny)
  const meta = {
    mime,
    originalName: originalName ?? null,
  };

  await put(metaKey, new Blob([JSON.stringify(meta)], { type: 'application/json' }), {
    access: 'public',
    contentType: 'application/json',
    token: blobToken,
  });

  return { imgKey, metaKey };
}

/**
 * Fetch the image + metadata back from Blob storage.
 * Uses `list()` to obtain absolute URLs (works across @vercel/blob versions).
 */
export async function getImageFromBlob(token: string): Promise<StoredImageRecord> {
  const blobToken = requireBlobToken();
  const prefix = `images/${token}`;

  // Ask the Blob store for everything we have under this token.
  const { blobs } = await list({ prefix, token: blobToken });
  if (!blobs || blobs.length === 0) {
    throw new Error('No blobs found for token');
  }

  // Identify metadata and image entries
  const metaBlob = blobs.find((b) => b.pathname.endsWith('.json'));
  const imgBlob = blobs.find((b) => !b.pathname.endsWith('.json')); // the non-json is our image

  if (!metaBlob || !imgBlob) {
    throw new Error('Missing image or metadata');
  }

  // Read metadata JSON using its absolute URL
  const metaResp = await fetch(metaBlob.url);
  if (!metaResp.ok) {
    throw new Error(`Metadata not found (${metaResp.status})`);
  }
  const meta = (await metaResp.json()) as { mime?: string; originalName?: string | null };

  // Read image bytes from the absolute URL returned by the SDK
  const imgResp = await fetch(imgBlob.url);
  if (!imgResp.ok) {
    throw new Error(`Image not found (${imgResp.status})`);
  }
  const arr = await imgResp.arrayBuffer();

  // MIME: prefer blob header if present, fallback to metadata, then safe default
  const mime =
    // some @vercel/blob versions expose `contentType`
    (imgBlob as any).contentType ||
    meta?.mime ||
    'image/jpeg';

  return { data: new Uint8Array(arr), mime, originalName: meta?.originalName ?? null };
}