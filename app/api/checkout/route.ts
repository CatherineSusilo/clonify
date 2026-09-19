import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";

const PLAN_PRICES: Record<string, { name: string; amount: number }> = {
  pro: { name: "Clonify Pro", amount: 9900 },
  enterprise: { name: "Clonify Enterprise", amount: 49900 },
};

const bodySchema = z.object({ plan: z.enum(["pro", "enterprise"]) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const plan = PLAN_PRICES[parsed.data.plan];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            product_data: { name: plan.name },
            unit_amount: plan.amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      client_reference_id: user.id,
      metadata: { userId: user.id, plan: parsed.data.plan },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] Stripe error (check STRIPE_SECRET_KEY is a real test key):", err);
    return NextResponse.json(
      { error: "Stripe is not configured with a real test key yet." },
      { status: 502 }
    );
  }
}
