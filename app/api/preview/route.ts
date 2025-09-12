// app/api/preview/route.ts
import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveImageToBlob } from '@/lib/store';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

function bad(msg: string, status = 400) {
  return new Response(msg, { status });
}

// ✅ Hand Response an ArrayBuffer (universal BodyInit) – avoids Blob/Uint8Array typing on Vercel
function ok(bytes: Uint8Array, mime = 'image/jpeg') {
  // Slice the underlying buffer to a standalone ArrayBuffer for exactly this view
  const ab: ArrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return new Response(ab, { headers: { 'Content-Type': mime } });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const userPrompt = String(form.get('prompt') || '').trim();
    if (!file || !userPrompt) return bad('Missing file or prompt');

    const mime = file.type || 'image/jpeg';
    const fileAb = await file.arrayBuffer();
    const base64 = Buffer.from(fileAb).toString('base64');

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return bad('Server missing GOOGLE_API_KEY', 500);

    const genAI = new GoogleGenerativeAI(apiKey);

    // Use the model you listed via ListModels
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image-preview',
    });

    const instruction =
      `Remove ONLY the described person. Inpaint the missing area naturally. ` +
      `Do not change any other person. Return one edited image.\n\n` +
      `Person to remove: "${userPrompt}".`;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: instruction },
            { inlineData: { mimeType: mime, data: base64 } },
          ],
        },
      ],
    });

    // Extract first image from response
    const parts =
      (result as any)?.response?.candidates?.[0]?.content?.parts ?? [];
    const imgPart =
      parts.find((p: any) => p?.inlineData?.data)?.inlineData || null;

    if (!imgPart?.data) {
      console.error(
        'Model returned no image. Full response:',
        JSON.stringify((result as any)?.response ?? result, null, 2),
      );
      return bad('The model did not return an image. Please try again.', 502);
    }

    const outMime = imgPart?.mimeType || 'image/jpeg';
    const bytes = Buffer.from(imgPart.data, 'base64');

    // Persist the edited image and return a token
    const token = randomUUID();
    try {
      // Delegate persistence to lib/store (handles Vercel Blob or in-memory)
      await saveImageToBlob(token, bytes, outMime, file.name || undefined);
    } catch (e) {
      console.error('Failed to save image:', e);
      return bad('Could not persist preview. Please try again.', 500);
    }

    // Return bytes to render the client-side preview AND pass token via header
    const outAb: ArrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;

    return new Response(outAb, {
      headers: {
        'Content-Type': outMime,
        'X-Uninvite-Token': token,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    try {
      console.error('Gemini error (raw):', err?.message || err);
      if (err?.response) {
        const body = await err.response.text();
        console.error('Gemini error body:', body);
      }
    } catch {
      /* ignore */
    }
    return bad('Preview failed on the server.', 500);
  }
}