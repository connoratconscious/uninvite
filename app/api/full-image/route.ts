import { NextRequest } from 'next/server';
import { getImage } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  const record = getImage(token);
  if (!record) {
    return new Response('Not found or expired', { status: 404 });
  }

  // ✅ Normalize to a plain Uint8Array with explicit type
  const u8: Uint8Array =
    record.data instanceof Uint8Array
      ? record.data
      : new Uint8Array(record.data as ArrayBufferLike);

  // ✅ Make a standalone ArrayBuffer slice (no SharedArrayBuffer union, no Buffer)
  const ab: ArrayBuffer = u8.buffer.slice(
    u8.byteOffset,
    u8.byteOffset + u8.byteLength
  ) as ArrayBuffer;

  // ✅ ArrayBuffer is a valid BodyInit in the Fetch spec and passes TS on Vercel
  return new Response(ab, {
    headers: {
      'Content-Type': record.mime,
      'Content-Disposition': 'attachment; filename="uninvite-full.jpg"',
    },
  });
}