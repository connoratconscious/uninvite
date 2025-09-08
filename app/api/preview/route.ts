// app/api/preview/route.ts
import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

function bad(msg: string, status = 400) {
  return new Response(msg, { status });
}

// ✅ Hand Response a Blob (web BodyInit) – no Buffer, no Uint8Array
function ok(bytes: Uint8Array, mime = 'image/jpeg') {
  // Get a clean ArrayBuffer for just the view’s slice
  const ab: ArrayBuffer =
    (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength)
      ? (bytes.buffer as ArrayBuffer)
      : bytes.slice().buffer; // copies then gives a pure ArrayBuffer

  const blob = new Blob([ab], { type: mime }); // Blob is valid BodyInit
  return new Response(blob, { headers: { 'Content-Type': mime } });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const userPrompt = String(form.get('prompt') || '').trim();
    if (!file || !userPrompt) return bad('Missing file or prompt');

    const mime = file.type || 'image/jpeg';
    const ab = await file.arrayBuffer();
    const base64 = Buffer.from(ab).toString('base64');

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
    const imgPart = parts.find((p: any) => p?.inlineData?.data)?.inlineData || null;

    if (!imgPart?.data) {
      console.error(
        'Model returned no image. Full response:',
        JSON.stringify((result as any)?.response ?? result, null, 2)
      );
      return bad('The model did not return an image. Please try again.', 502);
    }

    const outMime = imgPart?.mimeType || 'image/jpeg';
    const bytes = Buffer.from(imgPart.data, 'base64'); // already a Buffer, ok() will still handle
    return ok(bytes, outMime);
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