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
      if (!res.ok) throw new Error("Failed to save role");
      router.push("/scan");
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
      <h1 className="text-3xl font-bold">Who are you working as?</h1>
      <p className="mt-2 text-zinc-400">
        We&apos;ll configure your workspace, viewer tools, and exports around
        your role.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {ROLES.map((key) => {
          const info = ROLE_INFO[key];
          const selected = role === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setRole(key)}
              className={clsx(
                "rounded-2xl border p-6 text-left transition",
                selected
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
              )}
            >
              <p className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">
                {info.sdg}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{info.label}</h3>
              <p className="mt-2 text-sm text-zinc-400">{info.tagline}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex items-center gap-4">
        <span className="text-sm text-zinc-400">Units</span>
        <div className="flex overflow-hidden rounded-full border border-zinc-800">
          {(["IMPERIAL", "METRIC"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={clsx(
                "px-4 py-1.5 text-sm",
                unit === u ? "bg-indigo-500 text-white" : "text-zinc-400"
              )}
            >
              {u === "IMPERIAL" ? "Imperial" : "Metric"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <button
        type="button"
        disabled={!role || submitting}
        onClick={handleContinue}
        className="mt-10 w-fit rounded-full bg-indigo-500 px-8 py-3 font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}
