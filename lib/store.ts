// lib/store.ts
import { put, head } from '@vercel/blob';

function extFromMime(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

// Save the image bytes to Vercel Blob under a stable key derived from token
export async function saveImageToBlob(token: string, bytes: Uint8Array, mime: string) {
  const ext = extFromMime(mime);
  const key = `images/${token}.${ext}`;

  await put(key, bytes, {
    access: 'private',                       // we stream via our API
    contentType: mime,
    token: process.env.BLOB_READ_WRITE_TOKEN!, // set in Vercel env vars
  });

  return { key, mime };
}

// Retrieve the image by token (try common extensions)
export async function getImageFromBlob(token: string):
  Promise<{ data: Uint8Array; mime: string } | null> {
  const exts = ['jpg', 'png', 'webp'];
  for (const ext of exts) {
    const key = `images/${token}.${ext}`;
    try {
      // HEAD gives a signed downloadUrl if the blob exists
      const meta = await head(key, { token: process.env.BLOB_READ_WRITE_TOKEN! });
      const res = await fetch(meta.downloadUrl);
      if (!res.ok) continue;

      const mime = res.headers.get('content-type') || 'image/jpeg';
      const ab = await res.arrayBuffer();
      return { data: new Uint8Array(ab), mime };
    } catch {
      // try the next extension
    }
  }
  return null;
}