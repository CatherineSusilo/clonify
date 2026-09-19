import Stripe from "stripe";

let stripeClient: Stripe | null | undefined;

function isUsableKey(key: string | undefined) {
  return Boolean(key && key.startsWith("sk_") && !key.includes("placeholder"));
}

/** Returns a Stripe client when a real secret key is configured; otherwise
 * null so checkout can fail with a clear 502 instead of crashing the app. */
export function getStripe(): Stripe | null {
  if (stripeClient !== undefined) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  stripeClient = isUsableKey(key)
    ? new Stripe(key!, { apiVersion: "2026-08-26.dahlia" })
    : null;
  return stripeClient;
}
