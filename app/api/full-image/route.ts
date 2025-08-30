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

  // Normalize to Uint8Array
  const bytes =
    record.data instanceof Uint8Array
      ? record.data
      : new Uint8Array(record.data as ArrayBufferLike);

  // ✅ Wrap bytes in a Blob so Response(body) is a valid BodyInit
  const body = new Blob([bytes], { type: record.mime });

  return new Response(body, {
    headers: {
      'Content-Type': record.mime,
      'Content-Disposition': 'attachment; filename="uninvite-full.jpg"',
    },
  });
}
