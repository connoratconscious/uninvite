'use client';
import React, { useState } from 'react';

async function addWatermarkToBlob(blob: Blob, text = 'PREVIEW') {
  const img = document.createElement('img');
  img.src = URL.createObjectURL(blob);
  await new Promise((r) => (img.onload = r));

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;

  // draw original image
  ctx.drawImage(img, 0, 0);

  // watermark text
  const size = Math.round(Math.min(canvas.width, canvas.height) / 8);
  ctx.font = `${size}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'center';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.fillText(text, 0, 0);

  return await new Promise<string>((resolve) =>
    canvas.toBlob((b) => resolve(URL.createObjectURL(b!)), 'image/jpeg', 0.9)
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePreview() {
    if (!file || !prompt) return;
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('prompt', prompt);

      const res = await fetch('/api/preview', { method: 'POST', body: fd });
      if (!res.ok) {
        alert('Preview failed');
        return;
      }

      // token for server-side full image retrieval
      const token = res.headers.get('X-Uninvite-Token');
      if (token) localStorage.setItem('uninvite_token', token);

      // clean (unwatermarked) model output
      const cleanBlob = await res.blob();

      // store for MVP success page
      const dataUrl = await new Promise<string>((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.readAsDataURL(cleanBlob);
      });
      localStorage.setItem('uninvite_full_image', dataUrl);
      localStorage.setItem('uninvite_full_mime', cleanBlob.type || 'image/jpeg');

      // watermarked preview
      const wmUrl = await addWatermarkToBlob(cleanBlob, 'PREVIEW');
      setPreviewUrl(wmUrl);
    } catch (e: any) {
      alert('Preview error: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    try {
      const token = localStorage.getItem('uninvite_token') || '';
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert('Checkout error: ' + txt);
        return;
      }
      const data = await res.json();
      if (!data?.url) {
        alert('No checkout URL returned');
        return;
      }
      window.location.href = data.url; // go to Stripe
    } catch (e: any) {
      alert('JS error: ' + (e?.message || e));
    }
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-3">Remove Someone From a Photo</h1>
      <p className="text-sm mb-4">Upload → describe → preview → pay & download.</p>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mb-3"
      />

      <input
        className="border rounded p-2 w-full mb-3"
        placeholder='e.g. "man in a red shirt on the left"'
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          disabled={!file || !prompt || loading}
          className="px-4 py-2 rounded bg-black text-white disabled:bg-gray-400"
        >
          {loading ? 'Editing…' : 'Generate preview'}
        </button>
        <button onClick={handlePay} className="px-4 py-2 rounded border">
          Pay & Download
        </button>
      </div>

      {previewUrl && (
        <div className="mt-6">
          <p className="text-sm mb-2">Preview (watermarked). Full-res after payment.</p>
          <img src={previewUrl} alt="preview" className="w-full rounded border" />
        </div>
      )}
    </main>
  );
}
