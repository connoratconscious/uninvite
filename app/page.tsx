'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

// --- Small util used by sliders ---
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// --- Trust badges as data (clean + testable) ---
const TRUST_BADGES = [
  { icon: '🔒', label: 'Secure Payment' },
  { icon: '🖼️', label: '99% accuracy' },
  { icon: '🚫', label: 'No photo storage' },
  { icon: '⚡', label: 'Rapid removal' },
];

// --- Watermark helper (client-side) ---
async function addWatermarkToBlob(blob: Blob, text = 'PREVIEW') {
  const img = document.createElement('img');
  img.src = URL.createObjectURL(blob);
  await new Promise((r) => (img.onload = r));

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const size = Math.round(Math.min(canvas.width, canvas.height) / 7.5);
  ctx.font = `${size}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.fillText(text, 0, 0);

  return await new Promise<string>((resolve) =>
    canvas.toBlob((b) => resolve(URL.createObjectURL(b!)), 'image/jpeg', 0.9)
  );
}

// --- Image with smart fallbacks (.jpeg/.jpg and queryless) ---
function SmartImage({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);

  // Build a small list of candidates:
  // 1) the given src
  // 2) same without query (?v=...)
  // 3) flip .jpeg/.jpg extension (with and without query)
  const noQuery = src.split('?')[0];
  const hasQuery = src.includes('?');
  const jpegToJpg = noQuery.endsWith('.jpeg') ? noQuery.replace(/\.jpeg$/i, '.jpg') : null;
  const jpgToJpeg = noQuery.endsWith('.jpg') ? noQuery.replace(/\.jpg$/i, '.jpeg') : null;

  const candidates = Array.from(
    new Set(
      [
        src,
        noQuery,
        jpegToJpg ? jpegToJpg + (hasQuery ? src.slice(src.indexOf('?')) : '') : null,
        jpegToJpg,
        jpgToJpeg ? jpgToJpeg + (hasQuery ? src.slice(src.indexOf('?')) : '') : null,
        jpgToJpeg,
      ].filter(Boolean) as string[]
    )
  );

  const current = candidates[idx] || candidates[candidates.length - 1];

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      onError={() => {
        if (idx < candidates.length - 1) {
          setIdx(idx + 1);
        } else {
          console.error('All image candidates failed for:', src, candidates);
        }
      }}
    />
  );
}

// --- Generic reveal slider used everywhere (hero + cards) ---
function RevealSlider({
  beforeSrc,
  afterSrc,
  className = '',
  initial = 50,
}: {
  beforeSrc: string;
  afterSrc: string;
  className?: string;
  initial?: number;
}) {
  const [v, setV] = useState(initial);

  return (
    <div className={`relative w-full aspect-[4/3] overflow-hidden ${className}`}>
      {/* Base layer: AFTER image (always fills, below) */}
      <SmartImage
        src={afterSrc}
        alt="After"
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
      />

      {/* Overlay layer: BEFORE image (revealed amount = slider %) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${v}%` }}>
        <SmartImage
          src={beforeSrc}
          alt="Before"
          className="w-full h-full object-cover select-none pointer-events-none"
        />
      </div>

      {/* Split indicator at the reveal edge */}
      <div className="absolute top-0 bottom-0" style={{ left: `${v}%` }}>
        <div className="w-px h-full bg-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
      </div>

      {/* Range control */}
      <input
        type="range"
        min={0}
        max={100}
        value={v}
        onChange={(e) => setV(clamp(Number(e.target.value), 0, 100))}
        aria-label="Compare before and after"
        className="absolute z-10 bottom-3 left-1/2 -translate-x-1/2 w-11/12 sm:w-2/3 accent-purple-600"
        style={{ touchAction: 'none' }}
      />

      {/* Corner labels */}
      <span className="absolute left-2 top-2 text-[11px] px-2 py-0.5 rounded bg-black/50 text-white">
        Before
      </span>
      <span className="absolute right-2 top-2 text-[11px] px-2 py-0.5 rounded bg-black/50 text-white">
        After
      </span>
    </div>
  );
}

// --- Card wrapper that uses RevealSlider and (optionally) shows meta ---
function BeforeAfterCard({
  before,
  after,
  caption,
  chips,
  showMeta = true,
}: {
  before: string;
  after: string;
  caption: string;
  chips: string[];
  showMeta?: boolean;
}) {
  return (
    <div className="rounded-xl overflow-hidden shadow ring-1 ring-zinc-200 bg-white p-3 flex flex-col">
      <RevealSlider beforeSrc={before} afterSrc={after} />

      {showMeta && (
        <>
          <div className="mt-3 flex flex-wrap gap-1 justify-center">
            {chips.map((c) => (
              <span
                key={c}
                className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 ring-1 ring-zinc-200"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-600 text-center">{caption}</p>
        </>
      )}
    </div>
  );
}

export default function DeleteMyExLanding() {
  // --- App state wired to your backend ---
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // hero demo slider
  const [sliderValue, setSliderValue] = useState(50);

  // original file preview URL
  const originalUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  // file input ref for "Change photo"
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // lightweight runtime checks (from your snippet)
    console.assert(clamp(150, 0, 100) === 100, 'clamp should cap high');
    console.assert(clamp(-5, 0, 100) === 0, 'clamp should cap low');
    console.assert(clamp(42, 0, 100) === 42, 'clamp should allow mid');
    console.assert(TRUST_BADGES.length === 4, 'Expected 4 trust badges');
    console.assert(sliderValue === 50, 'Hero slider default should be 50');
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- HANDLERS (exact wiring to your API) ---
  async function handlePreview() {
    if (!file || !prompt || loading) return;
    setLoading(true);
    setPreviewUrl(null);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('prompt', prompt);

      const res = await fetch('/api/preview', { method: 'POST', body: fd });
      if (!res.ok) {
        const msg = await res.text().catch(() => 'Preview failed');
        alert(msg || 'Preview failed');
        return;
      }

      // token for full download after payment
      const token = res.headers.get('X-Uninvite-Token');
      if (token) localStorage.setItem('uninvite_token', token);

      // Clean (unwatermarked) model output
      const cleanBlob = await res.blob();

      // Save for /success page (MVP approach)
      const dataUrl = await new Promise<string>((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.readAsDataURL(cleanBlob);
      });
      localStorage.setItem('uninvite_full_image', dataUrl);
      localStorage.setItem('uninvite_full_mime', cleanBlob.type || 'image/jpeg');

      // Watermarked preview
      const wmUrl = await addWatermarkToBlob(cleanBlob, 'PREVIEW');
      setPreviewUrl(wmUrl);
    } catch (e: any) {
      alert(e?.message || 'Preview error');
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
      window.location.href = data.url; // Stripe Checkout
    } catch (e: any) {
      alert(e?.message || 'Checkout error');
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      try {
        localStorage.setItem('uninvite_original_name', f.name);
      } catch {}
    }
  }

  function chooseNewFile() {
    setPreviewUrl(null);
    setFile(null);
    fileInputRef.current?.click();
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Header */}
      <header className="bg-white">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100">
              <span className="text-lg">🗑️</span>
            </span>
            <h1 className="text-xl font-semibold tracking-tight">Ex-terminator</h1>
          </div>
          <nav className="flex items-center gap-6 text-sm text-zinc-600">
            <a href="#upload" className="hover:text-zinc-900">
              Upload
            </a>
            <a href="#examples" className="hover:text-zinc-900">
              Examples
            </a>
            <a href="#faq" className="hover:text-zinc-900">
              FAQ
            </a>
          </nav>
        </div>
      </header>

      {/* Hero (Before/After demo) */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 grid lg:grid-cols-2 gap-8 items-center py-6">
          <div>
            <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight">
              🔥 Remove your ex from photos in seconds
            </h2>
            <ul className="mt-4 space-y-2 text-lg text-zinc-700">
              <li>✏️ Upload your photo → Tell us who to remove</li>
              <li>📸 Our AI erases them cleanly in seconds</li>
              <li>🙅‍♂️ Remove your ex and unwanted people</li>
              <li>
                💨 Free preview. Download for just <strong>99p</strong>
              </li>
            </ul>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a
                href="#upload"
                className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-5 py-3 text-white font-medium shadow hover:bg-purple-700 transition"
              >
                Upload Photo
              </a>
              <a
                href="#examples"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-5 py-3 font-medium hover:bg-zinc-50 transition"
              >
                See Examples
              </a>
            </div>
          </div>

          {/* Interactive hero slider (static demo) */}
          <RevealSlider
            beforeSrc="/before-image.jpg"
            afterSrc="/after-image.jpg"
            className="rounded-2xl shadow ring-1 ring-zinc-200"
          />
        </div>
      </section>

      {/* Upload */}
<section id="upload" className="bg-zinc-50 border-t border-zinc-200">
  <div className="mx-auto max-w-3xl px-4 py-24 text-center">
    <h3 className="text-3xl font-bold">Upload your photo</h3>
    <p className="mt-2 text-zinc-600">Add your photo below 👇</p>

    {/* Upload box with 3 states */}
    <div className="mt-8 relative">
      {previewUrl ? (
        // --- STATE 3: Preview ready — single image inside the box
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-4 sm:p-6 shadow ring-1 ring-zinc-200">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 ring-1 ring-purple-200">
              <span>🖼️</span> Preview
            </span>
            <button
              onClick={chooseNewFile}
              className="text-xs px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-50"
            >
              Change photo
            </button>
          </div>

          <div className="mt-4">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-auto rounded-xl border object-contain"
            />
          </div>

          <p className="mt-3 text-[11px] text-zinc-500">
            This is a watermarked preview. You’ll get the full-resolution image after payment.
          </p>
        </div>
      ) : (
        // --- STATE 1 & 2: No file yet / file selected (improved visuals)
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="block cursor-pointer rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-10 sm:p-14 transition hover:border-purple-400 hover:shadow-lg hover:shadow-purple-100"
        >
          <div className="flex flex-col items-center text-center">
            {file ? (
              <>
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 text-2xl shadow-sm">
                  ✔️
                </span>

                <h4 className="mt-4 text-xl font-semibold">Photo uploaded</h4>

                <div className="mt-4 flex items-center gap-4">
                  {originalUrl && (
                    <img
                      src={originalUrl}
                      alt="Uploaded preview"
                      className="w-24 h-24 rounded-lg object-cover border"
                    />
                  )}
                  <div className="text-sm text-zinc-700 max-w-[260px] text-left">
                    <div className="font-medium truncate">{file.name}</div>
                    <div className="text-zinc-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'image'}
                    </div>
                    <div className="text-zinc-500 mt-1">Click to change</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <span className="text-3xl">📤</span>
                <span className="mt-2 text-base font-medium">
                  Click to upload or drag & drop
                </span>
                <p className="mt-1 text-xs text-zinc-500">JPG, PNG, WebP up to ~10MB</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f) {
                try {
                  localStorage.setItem('uninvite_original_name', f.name);
                } catch {}
              }
            }}
          />
        </label>
      )}
    </div>

    {/* Prompt + CTA */}
    <div className="mt-8 rounded-xl bg-white p-6 shadow ring-1 ring-zinc-200 text-left">
      <label htmlFor="prompt" className="text-sm font-medium block mb-2">
        Describe who to remove 👇
      </label>
      <input
        id="prompt"
        placeholder='e.g. "man in a red shirt on the left"'
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-600"
      />
      <p className="mt-2 text-xs text-zinc-500">
        ✅ Best: high quality photos with 2-3 people · ⚠️ Harder: group shots and low resolution images
      </p>

      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        <button
          onClick={handlePreview}
          disabled={!file || !prompt || loading}
          className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-sm font-medium text-white shadow transition-transform duration-150 hover:scale-[1.01] focus:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating…' : 'Generate Preview'}
        </button>
        <button
          onClick={handlePay}
          className="w-full rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium hover:bg-zinc-50 transition"
        >
          Pay & Download
        </button>
      </div>

      <p className="mt-3 text-[11px] text-zinc-500">
        Your preview appears above in the upload box.
      </p>
    </div>

    {/* Trust badges (unchanged) */}
    <div className="mt-12">
      <h4 className="text-sm font-semibold text-zinc-700 mb-4 text-left">
        Why trust us?
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {TRUST_BADGES.map((b) => (
          <div
            key={b.label}
            className="rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-zinc-200 flex items-center justify-center gap-2"
          >
            <span>{b.icon}</span>
            <span>{b.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-zinc-500">
        We auto-delete originals and results within 24h. Full details in our{" "}
        <a href="/privacy" className="underline hover:text-zinc-700">Privacy Policy</a>.
      </p>
    </div>
  </div>
</section>

      {/* Proof (static examples) */}
      <section id="examples" className="bg-zinc-50 border-t border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-24 text-center">
          <h3 className="text-3xl font-bold">Examples</h3>
          <p className="mt-2 text-zinc-600">
            Real photo edits. Slide to compare before and after.
          </p>
          <div className="mt-10 grid sm:grid-cols-3 gap-6">
            {[
              {
                before: '/proof1-before.jpg',
                after: '/proof1-after.jpeg',
                caption: '"ex in red dress on the left" → Solo at sunset',
                chips: ['Couple', 'Edge'],
                showMeta: false,
              },
              {
                before: '/proof2-before.jpg',
                after: '/proof2-after.jpeg',
                caption: '"man in white tee behind us" → Clean beach shot',
                chips: ['Background', 'Tourist'],
                showMeta: false,
              },
              {
                before: '/proof3-before.jpg',
                after: '/proof3-after.jpeg',
                caption: '"guy in cap on the right" → Solo portrait',
                chips: ['Selfie', 'Edge'],
                showMeta: false,
              },
            ].map((ex) => (
              <BeforeAfterCard key={ex.caption} {...ex} />
            ))}
          </div>
          <div className="mt-12">
            <a
              href="#upload"
              className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-5 py-3 text-white font-medium shadow hover:bg-purple-700 transition"
            >
              Try your photo
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white border-t border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <h3 className="text-2xl font-bold text-center">FAQ</h3>

          <div className="mt-12 grid md:grid-cols-2 gap-6 text-left">
            <div className="rounded-xl bg-white p-6 shadow ring-1 ring-zinc-200">
              <div className="text-lg font-semibold mb-2">How does Ex-terminator work?</div>
              <p className="text-zinc-700">
                Upload your photo, describe <span className="font-medium text-zinc-900">who to remove</span>,
                and our AI erases them while keeping the scene natural. You always get a
                <span className="font-medium text-zinc-900"> free preview</span> before paying.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow ring-1 ring-zinc-200">
              <div className="text-lg font-semibold mb-2">Can I remove someone from a group photo?</div>
              <p className="text-zinc-700">
                Yes. Results are <span className="font-medium text-zinc-900">best on couples & edge subjects</span>.
                Group hugs / heavy overlap are harder — but you’ll see the preview first.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow ring-1 ring-zinc-200">
              <div className="text-lg font-semibold mb-2">Does it work on selfies, weddings, or old pictures?</div>
              <p className="text-zinc-700">
                It works best on <span className="font-medium text-zinc-900">selfies or photos with 2–3 people</span>.
                It handles travel shots, weddings, and even old scans. Very large group shots may not look natural —
                the fewer faces, the cleaner the result. For best quality, use a <span className="font-medium text-zinc-900">high-resolution photo</span>.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow ring-1 ring-zinc-200">
              <div className="text-lg font-semibold mb-2">How long are photos stored?</div>
              <p className="text-zinc-700">
                Previews are stored locally in your browser. For full downloads, we keep a temporary copy only long enough
                for you to retrieve it and then delete it automatically (within 24 hours).
              </p>
            </div>
          </div>

          <div className="mt-12 flex items-center justify-center gap-4 text-sm text-zinc-600">
            <a href="/privacy" className="hover:text-zinc-800">Privacy</a>
            <span>·</span>
            <a href="/terms" className="hover:text-zinc-800">Terms</a>
            <span>·</span>
            <a href="mailto:info@removepersonfromphoto.com" className="hover:text-zinc-800">Support</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <div>&copy; {new Date().getFullYear()} Ex-terminator</div>
          <nav className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-zinc-700">Privacy</a>
            <a href="/terms" className="hover:text-zinc-700">Terms</a>
            <a href="mailto:info@removepersonfromphoto.com" className="hover:text-zinc-700">Support</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}