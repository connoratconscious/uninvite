// app/api/full-image/route.ts
import { NextRequest } from 'next/server';
import { getImageFromBlob } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LocalRecord = {
  data: Uint8Array | ArrayBufferLike;
  mime: string;
  originalName: string | null;
};

type BlobRecord = {
  downloadUrl: string; // signed URL from Vercel Blob
  mime: string;
  originalName: string | null;
};

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
  // Support ?name= and ?filename=
  const requestedBase = url.searchParams.get('name') || url.searchParams.get('filename');
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
    const filename = buildFilename(requestedBase, originalName ?? null, mime);

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

    const isHead = req.method === 'HEAD';

    // If we have a Vercel Blob signed URL, stream from it
    const maybeBlob = record as Partial<BlobRecord>;
    if (typeof maybeBlob.downloadUrl === 'string' && maybeBlob.downloadUrl.length > 0) {
      let upstream: Response;
      try {
        upstream = await fetch(maybeBlob.downloadUrl, { cache: 'no-store' });
      } catch (e) {
        console.error('Upstream fetch threw', e);
        return new Response('Upstream fetch failed', { status: 502 });
      }
      if (!upstream.ok) {
        console.error('Upstream fetch failed', upstream.status, await upstream.text().catch(() => ''));
        return new Response('Upstream fetch failed', { status: 502 });
      }
      const headers = new Headers();
      // Prefer upstream mime if present; otherwise our stored mime
      headers.set('Content-Type', upstream.headers.get('content-type') || mime);
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
      const len = upstream.headers.get('content-length');
      if (len) headers.set('Content-Length', len);
      if (isHead) {
        return new Response(null, { status: 200, headers });
      }
      return new Response(upstream.body, { headers });
    }

    // Otherwise use in-memory bytes (Uint8Array or ArrayBufferLike)
    const maybeLocal = record as Partial<LocalRecord>;
    if (maybeLocal.data) {
      const u8 = maybeLocal.data instanceof Uint8Array
        ? maybeLocal.data
        : new Uint8Array(maybeLocal.data as ArrayBufferLike);

      const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

      const headers = new Headers();
      headers.set('Content-Type', mime);
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
      if (isHead) {
        headers.set('Content-Length', String(ab.byteLength));
        return new Response(null, { status: 200, headers });
      }
      return new Response(ab, { headers });
    }

    console.error('Record had neither downloadUrl nor data', { token });
    return new Response('Server error', { status: 500 });
  } catch (err: any) {
    console.error('full-image fatal', err?.stack || err?.message || err);
    return new Response('Server error', { status: 500 });
  }
}