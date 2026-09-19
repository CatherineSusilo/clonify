import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_INFO, type RoleKey } from "@/lib/roles";

const ROLE_EXPORTS: Record<RoleKey, string[]> = {
  REAL_ESTATE: ["HD .glb / .usdz download", "High-res IMDF floor plan render", "Staged listing renders"],
  DISASTER_RELIEF: ["Disaster Claims Assessment PDF", "Volumetric damage report", "HD .glb export"],
  ACCESSIBILITY_AUDIT: ["ADA Compliance Report (PDF)", "High-res IMDF floor plan (PDF/CAD)"],
  MEP_ENGINEER: ["BIM/CAD export", "Clearance heatmap export", "IMDF blueprint sync"],
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const user = await getCurrentUser();

  let verified = false;
  let planName = "Pro";

  const stripe = getStripe();
  if (session_id && stripe) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      verified = session.payment_status === "paid" || session.status === "complete";
      planName = session.metadata?.plan === "enterprise" ? "Enterprise" : "Pro";

      // Fallback in case the local Stripe webhook listener isn't running.
      // Only apply it to the browser that actually owns this session — never
      // let an arbitrary visitor upgrade another account via a leaked session_id.
      const userId = session.metadata?.userId ?? session.client_reference_id;
      if (verified && userId && user?.id === userId) {
        await prisma.subscription.upsert({
          where: { userId },
          update: { isPro: true, plan: session.metadata?.plan },
          create: { userId, isPro: true, plan: session.metadata?.plan },
        });
      }
    } catch (err) {
      console.error("[checkout/success] could not verify session:", err);
    }
  }

  const role = user?.role;
  const info = role ? ROLE_INFO[role] : null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
      {verified ? (
        <>
          <p className="text-sm text-signal">Payment confirmed</p>
          <h1 className="font-display mt-2 text-2xl font-medium">{planName} plan unlocked</h1>
        </>
      ) : (
        <>
          <p className="text-sm text-amber">Could not verify session</p>
          <h1 className="font-display mt-2 text-2xl font-medium">
            Add a real Stripe test key to STRIPE_SECRET_KEY to complete checkout
          </h1>
        </>
      )}

      {info && (
        <div className="mt-8 border border-line bg-ink-soft p-6">
          <p className="text-sm text-blueprint-light">{info.label}</p>
          <p className="mt-3 text-sm text-muted">Now included with your plan:</p>
          <ul className="mt-2 divide-y divide-line">
            {ROLE_EXPORTS[role!].map((item) => (
              <li key={item} className="py-2 text-sm">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href="/scans"
        className="mt-8 w-fit border border-blueprint-light bg-blueprint px-6 py-3 font-medium hover:bg-blueprint/80"
      >
        Go to my scans
      </Link>
    </div>
  );
}
