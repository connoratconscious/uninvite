'use client';
import { useEffect, useState } from 'react';

export default function Success() {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // 1) Prefer the image we saved in the browser during preview
    const local = localStorage.getItem('uninvite_full_image');
    if (local) { setUrl(local); return; }

    // 2) Fallback to server fetch by token (works locally; on Vercel may be cold)
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setErr('Missing token. Please generate a new preview.'); return; }

    fetch(`/api/full-image?token=${encodeURIComponent(token)}`)
      .then(async r => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const b = await r.blob();
        setUrl(URL.createObjectURL(b));
      })
      .catch(e => setErr(`Could not fetch full image: ${e.message}`));
  }, []);

  return (
    <main className="p-6 max-w-3xl mx-auto text-white">
      <h1 className="text-4xl font-bold mb-6">Payment successful ✅</h1>
      <p className="mb-6 text-xl">Thanks! Your full-resolution image is ready below.</p>

      {err && <p className="text-red-400 mb-6">{err}</p>}
      {url && (
        <>
          <a href={url} download="uninvite-full.jpg"
             className="inline-block mb-4 px-4 py-2 rounded bg-white text-black">
            Download image
          </a>
          <img src={url} alt="final" className="w-full rounded border border-white/20" />
        </>
      )}
    </main>
  );
}
