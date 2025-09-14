// app/api/full-image/route.ts
import { NextRequest } from 'next/server';
import { getImageFromBlob } from '@/lib/store';

export const runtime = 'nodejs';

// Build a safe filename
function buildFilename(requestedBase: string | null, originalName: string | null, mime: string) {
  const ext =
    mime === 'image/png' ? 'png' :
    mime === 'image/webp' ? 'webp' :
    'jpg';

  if (requestedBase) {
    const base = requestedBase.replace(/[^\w.\-]/g, '') || 'photo-edited';
    return `${base}.${ext}`;
  }
  if (originalName) {
    const raw = originalName.replace(/\.[^/.]+$/,''); // strip ext
    const safe = raw.replace(/[^\w.\-]/g, '') || 'photo';
    return `${safe}-edited.${ext}`;
  }
  return `photo-edited.${ext}`;
}

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const name  = url.searchParams.get('name');
  const debug = url.searchParams.get('debug') === '1';

  if (!token) {
    return debug
      ? Response.json({ ok:false, error:'Missing token' }, { status: 400 })
      : new Response('Missing token', { status: 400 });
  }

  try {
    // Pull metadata/handles from our store
    const record = await getImageFromBlob(token);
    if (!record) {
      return debug
        ? Response.json({ ok:false, error:'Not found or expired' }, { status: 404 })
        : new Response('Not found or expired', { status: 404 });
    }

    const { mime, originalName } = record;
    const filename = buildFilename(name, originalName ?? null, mime);

    // DEBUG path (no bytes)
    if (debug) {
      return Response.json({
        ok: true,
        token,
        mime,
        filename,
        haveDownloadUrl: Boolean((record as any).downloadUrl),
        haveBytes: Boolean((record as any).data),
        elapsedMs: Date.now() - t0,
      });
    }

    // If we have a Vercel Blob signed URL, stream from it
    if ('downloadUrl' in record && record.downloadUrl) {
      const upstream = await fetch(record.downloadUrl);
      if (!upstream.ok) {
        console.error('Upstream fetch failed', upstream.status, await upstream.text().catch(()=>''));
        return new Response('Upstream fetch failed', { status: 502 });
      }
      // Stream body through with our headers
      return new Response(upstream.body, {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    }

    // Otherwise use in-memory bytes (Uint8Array or ArrayBufferLike)
    if ('data' in record && record.data) {
      const u8 = record.data instanceof Uint8Array
        ? record.data
        : new Uint8Array(record.data as ArrayBufferLike);

      // Make a standalone ArrayBuffer slice (avoid SharedArrayBuffer issues)
      const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

      return new Response(ab, {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    }

    console.error('Record had neither downloadUrl nor data', { token });
    return new Response('Server error', { status: 500 });
  } catch (err: any) {
    console.error('full-image fatal', err?.stack || err?.message || err);
    return new Response('Server error', { status: 500 });
  }
}