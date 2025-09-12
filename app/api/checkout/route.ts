export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {});

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY env var');
}
if (!process.env.STRIPE_PRICE_ID) {
  throw new Error('Missing STRIPE_PRICE_ID env var');
}

export async function POST(req: Request) {
  try {
    const { token, originalName } = await req.json(); // token saved after preview
    if (!token) {
      return new NextResponse('Missing token', { status: 400 });
    }

    const base =
      process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, '') ||
      'http://localhost:3000';

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'hosted',
      line_items: [
        { price: process.env.STRIPE_PRICE_ID as string, quantity: 1 },
      ],
      success_url: `${base}/success?token=${encodeURIComponent(token)}`,
      cancel_url: `${base}/`,
      client_reference_id: token,
      payment_intent_data: {
        metadata: {
          token,
          originalName: originalName || '',
        },
      },
      metadata: {
        token,
        originalName: originalName || '',
      },
      allow_promotion_codes: false,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    const message =
      (err && (err.message || err.error || err.toString())) ||
      'Unknown error';
    return new NextResponse('Error: ' + message, { status: 500 });
  }
}
