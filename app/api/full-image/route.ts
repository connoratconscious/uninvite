'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function SuccessPage() {
  const sp = useSearchParams();
  const token = sp.get('token');
  const originalName = sp.get('name');

  const href = token
    ? `/api/full-image?token=${encodeURIComponent(token)}${
        originalName ? `&name=${encodeURIComponent(originalName)}` : ''
      }`
    : '#';

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">🔥 Your edited photo is ready</h1>
        <p className="mt-2 text-gray-600">
          Click download to save your full-resolution image.
        </p>

        <div className="mt-6 flex gap-3">
          <a
            href={href}
            download={originalName || 'photo-edited'}
            className="inline-flex items-center rounded-lg bg-fuchsia-600 px-5 py-3 font-medium text-white hover:bg-fuchsia-700"
          >
            Download edited photo
          </a>

          <Link
            href="/"
            className="inline-flex items-center rounded-lg border px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit another photo
          </Link>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          For privacy, downloads are temporary. Keep a copy once saved.
        </p>
      </div>
    </main>
  );
}