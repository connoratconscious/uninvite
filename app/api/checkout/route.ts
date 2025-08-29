import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export async function POST(req: Request) {
  try {
    const { token } = await req.json(); // token saved after preview
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_PRICE_ID as string, quantity: 1 }],
      success_url: `${base}/success?token=${encodeURIComponent(token || '')}`,
      cancel_url: `${base}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return new NextResponse('Error: ' + (err?.message || String(err)), { status: 500 });
  }
}
