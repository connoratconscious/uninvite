import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { putImage } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const userPrompt = String(form.get('prompt') || '').trim();
    if (!file || !userPrompt) return new Response('Missing file or prompt', { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString('base64');
    const mime = file.type || 'image/jpeg';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response('No GEMINI_API_KEY', { status: 500 });
    const genAI = new GoogleGenerativeAI(apiKey);

    // Use the Google image-edit model you enabled
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' });

    const prompt =
      `Edit this photo. Task: ${userPrompt}. ` +
      `Remove the described person and reconstruct the background naturally. Do not crop.`;

    const resp = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: mime, data: base64 } },
    ]);

    const parts = resp?.response?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p?.inlineData)?.inlineData;
    if (!imagePart?.data) return new Response('Model returned no image', { status: 502 });

    const out = Buffer.from(imagePart.data, 'base64');

    // 🔐 store clean image on the server and return a token in a header
    const token = putImage(out, mime);

    return new Response(out, {
      headers: {
        'Content-Type': mime,
        'X-Uninvite-Token': token,
      },
    });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('429')) return new Response('AI quota/rate limit', { status: 429 });
    console.error('Preview route error:', err);
    return new Response('Server error', { status: 500 });
  }
}