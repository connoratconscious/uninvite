import { NextRequest } from 'next/server';
import { getImage } from '@/lib/store';

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

  const record = getImage(token);
  if (!record) {
    return new Response('Not found or expired', { status: 404 });
  }

  // Normalize to plain Uint8Array and slice to a standalone ArrayBuffer
  const u8 =
    record.data instanceof Uint8Array
      ? record.data
      : new Uint8Array(record.data as ArrayBufferLike);

  const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

  const mime = normalizeMime(record.mime as string | null);
  const filename = safeFileName(requestedName, mime);

  return new Response(ab, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(u8.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}