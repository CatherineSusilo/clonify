"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ROLES, ROLE_INFO, type RoleKey } from "@/lib/roles";
import type { PlanLimits } from "@/lib/plans";
import { PRODUCTS, type ProductKey } from "@/lib/products";

export function AccountForm({
  email,
  initialRole,
  initialUnit,
  initialProducts,
  initialModelTrainingConsent,
  plan,
}: {
  email: string;
  initialRole: RoleKey;
  initialUnit: "IMPERIAL" | "METRIC";
  initialProducts: ProductKey[];
  initialModelTrainingConsent: boolean;
  plan: PlanLimits;
}) {
  const router = useRouter();
  const [role, setRole] = useState<RoleKey>(initialRole);
  const [unit, setUnit] = useState<"IMPERIAL" | "METRIC">(initialUnit);
  const [products, setProducts] = useState<ProductKey[]>(initialProducts.length ? initialProducts : ["NAVIGATION"]);
  const [modelTrainingConsent, setModelTrainingConsent] = useState(initialModelTrainingConsent);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, unitPreference: unit, productSelections: products, modelTrainingConsent }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Couldn't save account settings.");
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-10">
      <div>
        <p className="text-sm text-muted">Signed in as</p>
        <p className="mt-1 font-medium">{email}</p>
      </div>

      <div>
        <p className="text-sm text-muted">Plan</p>
        <p className="mt-1 font-medium">{plan.label}</p>
        {plan.id === "starter" && (
          <Link href="/pricing" className="mt-2 inline-block text-sm text-blueprint-light hover:underline">
            Upgrade to Pro
          </Link>
        )}
      </div>

      <div>
        <p className="mb-3 text-sm text-muted">Default role</p>
        <div className="divide-y divide-line border-y border-line">
          {ROLES.map((key) => {
            const info = ROLE_INFO[key];
            const selected = role === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setRole(key)}
                className={clsx(
                  "flex w-full items-center justify-between gap-6 py-4 text-left",
                  selected ? "text-ink-text" : "text-muted hover:text-ink-text"
                )}
              >
                <span className="font-display font-medium">{info.label}</span>
                <span
                  className={clsx(
                    "h-4 w-4 shrink-0 border",
                    selected ? "border-blueprint-light bg-blueprint-light" : "border-line"
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted">Units</span>
        <div className="flex border border-line">
          {(["IMPERIAL", "METRIC"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={clsx(
                "px-4 py-1.5 text-sm",
                unit === u ? "bg-blueprint text-ink-text" : "text-muted"
              )}
            >
              {u === "IMPERIAL" ? "Imperial" : "Metric"}
            </button>
          ))}
        </div>
        <div>
          <p className="mb-3 text-sm text-muted">Clonify workspace</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PRODUCTS.map((product) => {
              const selected = products.includes(product.key);
              return <button key={product.key} type="button" onClick={() => setProducts((current) => selected ? current.filter((key) => key !== product.key) : [...current, product.key])} className={clsx("border p-3 text-left text-sm", selected ? "border-blueprint-light bg-blueprint/20" : "border-line")}>{product.label}</button>;
            })}
          </div>
        </div>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" checked={modelTrainingConsent} onChange={(event) => setModelTrainingConsent(event.target.checked)} className="mt-1" />
          <span>Allow opted-in, de-identified captures to improve Clonify models. This can be withdrawn at any time.</span>
        </label>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-signal">Saved.</p>}

      <button
        type="submit"
        disabled={submitting}
        className="border border-blueprint-light bg-blueprint px-6 py-3 font-medium hover:bg-blueprint/80 disabled:opacity-40"
      >
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
