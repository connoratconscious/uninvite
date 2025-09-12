// app/api/full-image/route.ts
import { NextRequest } from 'next/server';
import { getImageFromBlob } from '@/lib/store';

export const runtime = 'nodejs';

// Safe filename helper
function safeFileName(
  requested: string | null,
  fallbackBase: string,
  mime: string
) {
  const ext =
    mime === 'image/png' ? 'png' :
    mime === 'image/webp' ? 'webp' :
    'jpg';

  // strip any existing extension and sanitize
  const baseRaw = (requested || fallbackBase).replace(/\.[^/.]+$/, '');
  const base = baseRaw.replace(/[^\w\-+\.]/g, '_') || fallbackBase;
  return `${base}.${ext}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const requestedName = searchParams.get('name') || searchParams.get('filename');

    if (!token) {
      return new Response('Missing token', { status: 400 });
    }

    // Fetch bytes + metadata from Blob (helper resolves any signed URL internally)
    const record = await getImageFromBlob(token);
    if (!record) {
      return new Response('Not found or expired', { status: 404 });
    }

    // Normalize to a standalone ArrayBuffer
    const u8 =
      record.data instanceof Uint8Array
        ? record.data
        : new Uint8Array(record.data as ArrayBufferLike);

    const ab: ArrayBuffer = u8.buffer.slice(
      u8.byteOffset,
      u8.byteOffset + u8.byteLength
    ) as ArrayBuffer;

    const fallbackBase =
      record.originalName
        ? record.originalName.replace(/\.[^/.]+$/, '') + '-edited'
        : 'photo-edited';

    const filename = safeFileName(requestedName, fallbackBase, record.mime);

    return new Response(ab, {
      headers: {
        'Content-Type': record.mime,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (err) {
    console.error('full-image route error:', err);
    return new Response('Server error', { status: 500 });
  }
}