import { NextRequest } from 'next/server';
import { getImageFromBlob } from '@/lib/store';

export const runtime = 'nodejs';

function normalizeMime(m?: string | null): 'image/jpeg' | 'image/png' | 'image/webp' {
  switch (m) {
    case 'image/png':
      return 'image/png';
    case 'image/webp':
      return 'image/webp';
    case 'image/jpeg':
    case 'image/jpg':
      return 'image/jpeg';
    default:
      return 'image/jpeg';
  }
}

// Safe filename helper
function safeFileName(requested: string | null, mime: string) {
  const ext =
    mime === 'image/png' ? 'png' :
    mime === 'image/webp' ? 'webp' :
    'jpg';

  // remove any extension from requested, sanitize, and default
  const baseRaw = (requested || 'photo-edited').replace(/\.[^/.]+$/, '');
  const base = baseRaw.replace(/[^\w\-+\.]/g, '_') || 'photo-edited';
  return `${base}.${ext}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const requestedName = searchParams.get('name') || searchParams.get('filename');

  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  // Pull metadata from our store. In local/dev this may contain raw bytes;
  // in production it may contain a Blob URL (e.g. Vercel Blob) we need to fetch.
  const record = getImageFromBlob(token) as
    | { data?: Uint8Array | ArrayBufferLike; mime?: string | null; url?: string | null }
    | null;

  if (!record) {
    return new Response('Not found or expired', { status: 404 });
  }

  let ab: ArrayBuffer;
  let mime: 'image/jpeg' | 'image/png' | 'image/webp' = normalizeMime(record.mime || null);

  if (record && record.url) {
    // Production path: fetch the original from blob storage
    const resp = await fetch(record.url);
    if (!resp.ok) {
      return new Response('File fetch failed', { status: 502 });
    }
    const ct = resp.headers.get('content-type');
    mime = normalizeMime(ct);
    ab = await resp.arrayBuffer();
  } else if (record && record.data) {
    // Dev/in-memory path
    const u8 =
      record.data instanceof Uint8Array
        ? record.data
        : new Uint8Array(record.data as ArrayBufferLike);
    ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
  } else {
    return new Response('Missing file data', { status: 500 });
  }

  const filename = safeFileName(requestedName, mime);
  const body = ab as ArrayBuffer;

  return new Response(body, {
    headers: {
      'Content-Type': mime,
      // sending Content-Length only when known can avoid some proxies mislabelling;
      // we’ll compute it if possible.
      ...(typeof body.byteLength === 'number' ? { 'Content-Length': String(body.byteLength) } : {}),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}