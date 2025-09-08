// lib/store.ts
import { put, head } from '@vercel/blob';

/**
 * We store two things per token in Vercel Blob:
 * 1) The binary image at images/{token}.{ext}
 * 2) A small JSON sidecar at images/{token}.json with metadata
 *
 * This lets us keep createdAt/originalName without relying on in-memory maps.
 */

type ImageMeta = {
  mime: string;
  createdAt: number;
  originalName?: string;
};

function extFromMime(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg'; // default
}

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN!;

export async function saveImageToBlob(
  token: string,
  bytes: Uint8Array,
  mime: string,
  originalName?: string
) {
  const ext = extFromMime(mime);
  const imgKey = `images/${token}.${ext}`;
  const metaKey = `images/${token}.json`;

  // 1) Upload the image
  await put(
    imgKey,
    new Blob([bytes], { type: mime }),
    {
      access: 'private',
      contentType: mime,
      token: BLOB_TOKEN,
    }
  );

  // 2) Upload the metadata JSON (createdAt + originalName + mime)
  const meta: ImageMeta = {
    mime,
    createdAt: Date.now(),
    originalName,
  };

  await put(
    metaKey,
    new Blob([JSON.stringify(meta)], { type: 'application/json; charset=utf-8' }),
    {
      access: 'private',
      contentType: 'application/json; charset=utf-8',
      token: BLOB_TOKEN,
    }
  );

  return { key: imgKey, mime };
}

/**
 * Fetch metadata sidecar. Returns null if not found.
 */
export async function getImageMeta(token: string): Promise<ImageMeta | null> {
  const metaKey = `images/${token}.json`;
  try {
    const metaHead = await head(metaKey, { token: BLOB_TOKEN });
    const res = await fetch(metaHead.downloadUrl);
    if (!res.ok) return null;
    const meta = (await res.json()) as ImageMeta;
    return meta;
  } catch {
    return null;
  }
}

/**
 * Retrieve the image by token. If metadata exists we use its MIME to
 * derive the extension; otherwise we probe common extensions.
 */
export async function getImageFromBlob(
  token: string
): Promise<{ data: Uint8Array; mime: string; meta: ImageMeta | null } | null> {
  // Try to read metadata first
  const meta = await getImageMeta(token);
  const tryExts = meta ? [extFromMime(meta.mime)] : ['jpg', 'png', 'webp'];

  for (const ext of tryExts) {
    const key = `images/${token}.${ext}`;
    try {
      const info = await head(key, { token: BLOB_TOKEN });
      const res = await fetch(info.downloadUrl);
      if (!res.ok) continue;
      const mime = res.headers.get('content-type') || (meta?.mime ?? 'image/jpeg');
      const ab = await res.arrayBuffer();
      return { data: new Uint8Array(ab), mime, meta: meta ?? null };
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Optional helper to check expiry based on createdAt in metadata.
 */
export function isExpired(createdAt: number, maxAgeMs = 24 * 60 * 60 * 1000) {
  return Date.now() - createdAt > maxAgeMs;
}