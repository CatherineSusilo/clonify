"use client";

import { useState } from "react";

const PLANS = [
  { id: null, name: "Starter", price: "$0" },
  { id: "pro" as const, name: "Pro", price: "$99/mo" },
  { id: "enterprise" as const, name: "Enterprise", price: "$499/mo" },
];

const ROWS: [string, boolean | string, boolean | string, boolean | string][] = [
  ["Active scans", "1", "Unlimited", "Unlimited"],
  ["Rooms per scan", "4", "Unlimited", "Unlimited"],
  ["360° room views", true, true, true],
  ["HD exports (glb / usdz)", false, true, true],
  ["Role-specific reports", false, true, true],
  ["BIM / CAD export", false, false, true],
  ["Team seats", "1", "1", "Unlimited"],
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
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
      <h1 className="font-display text-2xl font-medium">Pricing</h1>
      <p className="mt-2 text-muted">
        Test checkout with card 4242 4242 4242 4242, any future expiry and CVC.
      </p>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-3 font-normal text-muted"></th>
              {PLANS.map((plan) => (
                <th key={plan.name} className="py-3 pl-6 font-normal">
                  <p className="font-display text-base font-medium text-ink-text">{plan.name}</p>
                  <p className="text-muted">{plan.price}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, starter, pro, enterprise]) => (
              <tr key={label} className="border-b border-line">
                <td className="py-3 text-muted">{label}</td>
                {[starter, pro, enterprise].map((value, i) => (
                  <td key={i} className="py-3 pl-6">
                    {typeof value === "boolean" ? (
                      value ? (
                        <span className="text-signal">✓</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )
                    ) : (
                      value
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="py-4"></td>
              {PLANS.map((plan) => (
                <td key={plan.name} className="py-4 pl-6">
                  {plan.id ? (
                    <button
                      onClick={() => upgrade(plan.id!)}
                      disabled={loadingPlan === plan.id}
                      className="border border-blueprint-light bg-blueprint px-4 py-2 font-medium hover:bg-blueprint/80 disabled:opacity-50"
                    >
                      {loadingPlan === plan.id ? "Redirecting…" : `Upgrade`}
                    </button>
                  ) : (
                    <span className="text-sm text-muted">Current plan</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
