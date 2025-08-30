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

  // Always re-wrap Buffer into a plain Uint8Array
  const bytes = new Uint8Array(
    record.data.buffer,
    record.data.byteOffset,
    record.data.byteLength
  );

  return new Response(bytes, {
    headers: {
      'Content-Type': record.mime,
      'Content-Disposition': 'attachment; filename="uninvite-full.jpg"',
      'Cache-Control': 'no-store',
    },
  });
}
