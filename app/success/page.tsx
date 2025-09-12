import React from 'react';

// Prevent static prerender; this page depends on runtime query (?token=...)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = {
  token?: string;
  name?: string;
};

export default function SuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const token = searchParams?.token ?? '';

  // Allow overriding filename via ?name=…; otherwise default to "photo-edited"
  const safeBase =
    (searchParams?.name ?? 'photo-edited')
      // very small sanitization: keep word chars, dot, dash, underscore
      .replace(/[^\w.\-]/g, '') || 'photo-edited';

  // If we don't have a token, show a friendly message and action to go back
  if (!token) {
    return (
      <main className="min-h-screen bg-white text-zinc-900">
        {/* Header (same as home) */}
        <header className="bg-white border-b border-zinc-200">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 hover:opacity-90">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100">
                <span className="text-lg">🗑️</span>
              </span>
              <span className="text-lg font-semibold tracking-tight">Ex-terminator</span>
            </a>
            <nav className="flex items-center gap-6 text-sm text-zinc-600">
              <a href="/#upload" className="hover:text-zinc-900">Upload</a>
              <a href="/#examples" className="hover:text-zinc-900">Examples</a>
              <a href="/#faq" className="hover:text-zinc-900">FAQ</a>
            </nav>
          </div>
        </header>

        <section className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-2xl bg-white p-6 shadow ring-1 ring-zinc-200">
            <div className="mb-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-3 py-1 text-sm">
                ⚠️ Missing download token
              </span>
            </div>

            <h2 className="text-2xl font-bold">We couldn't find your download</h2>
            <p className="mt-2 text-zinc-600">
              Your session may have expired or the link is incomplete. Please go back to the homepage and generate a new preview.
            </p>

            <div className="mt-6">
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-white font-medium shadow hover:scale-[1.01] transition"
              >
                Return to homepage
              </a>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // Build API download URL; server will finalize extension + headers
  const p = new URLSearchParams();
  p.set('token', token);
  if (safeBase) p.set('name', safeBase);
  const downloadHref = `/api/full-image?${p.toString()}`;

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      {/* Header (same as home) */}
      <header className="bg-white border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 hover:opacity-90">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100">
              <span className="text-lg">🗑️</span>
            </span>
            <span className="text-lg font-semibold tracking-tight">Ex-terminator</span>
          </a>
          <nav className="flex items-center gap-6 text-sm text-zinc-600">
            <a href="/#upload" className="hover:text-zinc-900">Upload</a>
            <a href="/#examples" className="hover:text-zinc-900">Examples</a>
            <a href="/#faq" className="hover:text-zinc-900">FAQ</a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl bg-white p-6 shadow ring-1 ring-zinc-200">
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-3 py-1 text-sm">
              ✅ Payment successful
            </span>
          </div>

          <h2 className="text-2xl font-bold">🔥 Your edited photo is ready</h2>
          <p className="mt-2 text-zinc-600">Click download to save your full‑resolution image.</p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a
              href={downloadHref}
              className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-white font-medium shadow hover:scale-[1.01] transition"
            >
              Download edited photo
            </a>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium hover:bg-zinc-50"
            >
              Edit another photo
            </a>
          </div>

          <p className="mt-3 text-[11px] text-zinc-500">
            For privacy, downloads are temporary. Keep a copy once saved.
          </p>
        </div>
      </section>
    </main>
  );
}