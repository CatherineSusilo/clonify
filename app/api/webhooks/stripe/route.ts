import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId ?? session.client_reference_id;
    if (userId) {
      await prisma.subscription.upsert({
        where: { userId },
        update: {
          isPro: true,
          plan: session.metadata?.plan,
          stripeCustomerId: String(session.customer ?? ""),
          stripeSubscriptionId: String(session.subscription ?? ""),
        },
        create: {
          userId,
          isPro: true,
          plan: session.metadata?.plan,
          stripeCustomerId: String(session.customer ?? ""),
          stripeSubscriptionId: String(session.subscription ?? ""),
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
