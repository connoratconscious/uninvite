'use client';

import { useEffect, useState } from 'react';

export default function SuccessPage() {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        setError(null);

        // 1) Try to get token from URL (?token=...)
        const sp = new URLSearchParams(window.location.search);
        let token = sp.get('token');

        // 2) Fallback to localStorage (set during preview)
        if (!token) token = localStorage.getItem('uninvite_token') || '';

        if (!token) {
          setError('Missing token. Please generate a new preview and pay again.');
          return;
        }

        // 3) Fetch the full, clean image from your server
        const res = await fetch(`/api/full-image?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const txt = await res.text();
          setError(`Could not fetch full image (${res.status}): ${txt}`);
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setImgUrl(url);
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    }
    run();
  }, []);

  async function download() {
    if (!imgUrl) return;
    try {
      setDownloading(true);
      const a = document.createElement('a');
      a.href = imgUrl;
      a.download = 'uninvite-full.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main style={{ maxWidth: 680, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Payment successful ✅
      </h1>
      <p style={{ marginBottom: 12 }}>
        Thanks! Your full-resolution image is ready below.
      </p>

      {error && (
        <div style={{ color: 'crimson', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {imgUrl ? (
        <>
          <img
            src={imgUrl}
            alt="Final"
            style={{ width: '100%', borderRadius: 8, border: '1px solid #333', marginBottom: 12 }}
          />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={download}
              disabled={downloading}
              style={{ padding: '10px 14px', border: '1px solid #888', borderRadius: 8 }}
            >
              ⬇️ {downloading ? 'Preparing…' : 'Download full image'}
            </button>
            <a href="/" style={{ padding: '10px 14px', border: '1px solid #888', borderRadius: 8, textDecoration: 'none' }}>
              ← Back to the app
            </a>
          </div>
        </>
      ) : (
        !error && <p>Loading your image…</p>
      )}
    </main>
  );
}
