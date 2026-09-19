import Link from "next/link";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/visitor";
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

  if (session_id) {
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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      {verified ? (
        <>
          <p className="text-sm font-semibold text-emerald-400">Payment confirmed</p>
          <h1 className="mt-2 text-3xl font-bold">{planName} workspace unlocked</h1>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-amber-400">Could not verify session</p>
          <h1 className="mt-2 text-3xl font-bold">
            Add a real Stripe test key to STRIPE_SECRET_KEY to complete checkout
          </h1>
        </>
      )}

      {info && (
        <div className="mt-10 w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-left">
          <p className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">
            {info.sdg} · {info.label}
          </p>
          <p className="mt-4 text-sm text-zinc-400">Unlocked exports for your role:</p>
          <ul className="mt-2 space-y-2 text-sm">
            {ROLE_EXPORTS[role!].map((item) => (
              <li key={item} className="rounded-lg bg-zinc-900 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href="/scan"
        className="mt-10 rounded-full bg-indigo-500 px-8 py-3 font-semibold text-white transition hover:bg-indigo-400"
      >
        Start a new scan
      </Link>
    </div>
  );
}
