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

  const bytes =
  record.data instanceof Uint8Array
    ? record.data
    : new Uint8Array(record.data as ArrayBufferLike);

return new Response(bytes, {
  headers: {
    'Content-Type': record.mime,
    'Content-Disposition': 'attachment; filename="uninvite-full.jpg"',
  },
});
}
