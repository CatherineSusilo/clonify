"use client";

import { useState } from "react";

const TIERS = [
  { id: null, name: "Starter", price: "$0", features: ["1 active scan", "Standard exports", "Web viewer"] },
  { id: "pro" as const, name: "Pro", price: "$99/mo", features: ["Unlimited scans", "HD exports", "Role-specific reports"], highlight: true },
  { id: "enterprise" as const, name: "Enterprise", price: "$499/mo", features: ["Team seats", "BIM/CAD pipeline", "Priority support"] },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upgrade(plan: "pro" | "enterprise") {
    setLoadingPlan(plan);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoadingPlan(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
      <h1 className="text-center text-3xl font-bold">Pricing</h1>
      <p className="mt-2 text-center text-zinc-400">
        Test checkout with card 4242 4242 4242 4242, any future date/CVC.
      </p>
      {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-2xl border p-8 ${
              tier.highlight ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-800 bg-zinc-950"
            }`}
          >
            <h3 className="text-lg font-semibold">{tier.name}</h3>
            <p className="mt-2 text-3xl font-bold">{tier.price}</p>
            <ul className="mt-6 space-y-2 text-sm text-zinc-400">
              {tier.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            {tier.id ? (
              <button
                onClick={() => upgrade(tier.id!)}
                disabled={loadingPlan === tier.id}
                className="mt-8 w-full rounded-full bg-indigo-500 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
              >
                {loadingPlan === tier.id ? "Redirecting…" : `Upgrade to ${tier.name}`}
              </button>
            ) : (
              <p className="mt-8 text-center text-sm text-zinc-500">Current plan</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
