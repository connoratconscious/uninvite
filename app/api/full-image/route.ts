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

  // Always normalize to Uint8Array (no Buffer/SharedArrayBuffer unions)
  const u8 =
    record.data instanceof Uint8Array
      ? record.data
      : new Uint8Array(record.data as ArrayBufferLike);

  // Blob accepts ArrayBufferView (Uint8Array is fine)
  const body = new Blob([u8], { type: record.mime });

  return new Response(body, {
    headers: {
      'Content-Type': record.mime,
      'Content-Disposition': 'attachment; filename="uninvite-full.jpg"',
    },
  });
}
