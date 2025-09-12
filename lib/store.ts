// lib/store.ts
import { put, head } from '@vercel/blob';

type ImageMeta = {
  mime: string;
  createdAt: number;
  originalName?: string;
};

function extFromMime(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
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

  // Convert Uint8Array → ArrayBuffer
  const ab = toArrayBuffer(bytes);

  // Upload image
  await put(imgKey, new Blob([ab], { type: mime }), {
    access: 'public', // Vercel Blob only supports "public"
    contentType: mime,
    token: BLOB_TOKEN,
  });

  // Upload metadata
  const meta: ImageMeta = { mime, createdAt: Date.now(), originalName };
  await put(metaKey, new Blob([JSON.stringify(meta)], {
    type: 'application/json; charset=utf-8',
  }), {
    access: 'public',
    contentType: 'application/json; charset=utf-8',
    token: BLOB_TOKEN,
  });

  return { key: imgKey, mime };
}

export async function getImageMeta(token: string): Promise<ImageMeta | null> {
  const metaKey = `images/${token}.json`;
  try {
    const metaHead = await head(metaKey, { token: BLOB_TOKEN });
    const res = await fetch(metaHead.downloadUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ImageMeta;
  } catch {
    return null;
  }
}

export async function getImageFromBlob(
  token: string
): Promise<{ data: Uint8Array; mime: string; meta: ImageMeta | null } | null> {
  const meta = await getImageMeta(token);
  const tryExts = meta ? [extFromMime(meta.mime)] : ['jpg', 'png', 'webp'];

  for (const ext of tryExts) {
    const key = `images/${token}.${ext}`;
    try {
      const info = await head(key, { token: BLOB_TOKEN });
      const inferredMime =
        ext === 'png' ? 'image/png' :
        ext === 'webp' ? 'image/webp' :
        'image/jpeg';
      const res = await fetch(info.downloadUrl);
      if (!res.ok) continue;
      const mime = res.headers.get('content-type') || meta?.mime || inferredMime;
      const ab = await res.arrayBuffer();
      return { data: new Uint8Array(ab), mime, meta: meta ?? null };
    } catch {
      continue;
    }
  }
  return null;
}

export function isExpired(createdAt: number, maxAgeMs = 24 * 60 * 60 * 1000) {
  return Date.now() - createdAt > maxAgeMs;
}

export function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u8.byteLength);
  new Uint8Array(out).set(u8);
  return out;
}