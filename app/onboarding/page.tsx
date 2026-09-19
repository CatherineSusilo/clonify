"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ROLES, ROLE_INFO, type RoleKey } from "@/lib/roles";

export default function OnboardingPage() {
  const router = useRouter();
  const [role, setRole] = useState<RoleKey | null>(null);
  const [unit, setUnit] = useState<"IMPERIAL" | "METRIC">("IMPERIAL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!role) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, unitPreference: unit }),
      });
      if (!res.ok) throw new Error("Couldn't save your role. Try again.");
      router.push("/scan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
      <h1 className="font-display text-2xl font-medium">What are you here to do?</h1>
      <p className="mt-2 text-muted">
        This sets your default fields, viewer tools, and export formats. You can change it later.
      </p>

      <div className="mt-10 divide-y divide-line border-y border-line">
        {ROLES.map((key) => {
          const info = ROLE_INFO[key];
          const selected = role === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setRole(key)}
              className={clsx(
                "flex w-full items-center justify-between gap-6 py-5 text-left",
                selected ? "text-ink-text" : "text-muted hover:text-ink-text"
              )}
            >
              <div>
                <h3 className="font-display text-lg font-medium">{info.label}</h3>
                <p className="mt-1 text-sm">{info.tagline}</p>
              </div>
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

      <div className="mt-8 flex items-center gap-4">
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
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <button
        type="button"
        disabled={!role || submitting}
        onClick={handleContinue}
        className="mt-10 w-fit border border-blueprint-light bg-blueprint px-6 py-3 font-medium hover:bg-blueprint/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}
