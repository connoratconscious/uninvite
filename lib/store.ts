// lib/store.ts
import { put, getDownloadUrl } from '@vercel/blob';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN!;

function extFromMime(mime: string) {
  return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
}

/**
 * Save image bytes (or just write metadata if bytes are already uploaded elsewhere).
 * - If `existingUrl` is provided, we only write metadata JSON.
 * - Otherwise we upload the image (private) + metadata.
 */
export async function saveImageToBlob(
  token: string,
  bytes: Uint8Array | null,
  mime: string,
  originalName?: string,
  existingUrl?: string
) {
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

    await put(
      imgKey,
      new Blob([ab], { type: mime }),
      {
        access: 'public',
        contentType: mime,
        token: BLOB_TOKEN,
      }
    );
  }

  // Always (re)write metadata
  const meta = {
    mime,
    originalName: originalName ?? null,
  };

  await put(
    metaKey,
    new Blob([JSON.stringify(meta)], { type: 'application/json' }),
    {
      access: 'public',
      contentType: 'application/json',
      token: BLOB_TOKEN,
    }
  );

  return { imgKey, metaKey };
}

/**
 * Fetch the image + metadata back from Blob storage.
 * We resolve the correct extension from metadata.mime.
 */
export async function getImageFromBlob(token: string): Promise<{
  data: Uint8Array;
  mime: string;
  originalName: string | null;
}> {
  const metaKey = `images/${token}.json`;

  // 1) Read metadata JSON
  const metaUrl = await getDownloadUrl(metaKey);
  const metaResp = await fetch(metaUrl);
  if (!metaResp.ok) throw new Error('Metadata not found');

  const meta = (await metaResp.json()) as { mime?: string; originalName?: string | null };
  const mime = meta?.mime || 'image/jpeg';
  const originalName = meta?.originalName ?? null;

  // 2) Read image using the right extension
  const ext = extFromMime(mime);
  const imgKey = `images/${token}.${ext}`;

  const imgUrl = await getDownloadUrl(imgKey);
  const imgResp = await fetch(imgUrl);
  if (!imgResp.ok) throw new Error('Image not found');

  const arr = await imgResp.arrayBuffer();
  return { data: new Uint8Array(arr), mime, originalName };
}