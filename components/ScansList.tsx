"use client";

import { useState } from "react";
import Link from "next/link";
import { ROLE_INFO, type RoleKey } from "@/lib/roles";
import type { PlanLimits } from "@/lib/plans";

export type ScanRow = {
  id: string;
  role: RoleKey;
  status: string;
  placeTitle: string | null;
  street: string;
  city: string;
  createdAt: string;
  _count: { rooms: number };
};

export function ScansList({
  initialScans,
  plan,
}: {
  initialScans: ScanRow[];
  plan: PlanLimits;
}) {
  const [scans, setScans] = useState(initialScans);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const atCap = plan.maxActiveScans !== null && scans.length >= plan.maxActiveScans;

  async function remove(id: string) {
    if (!confirm("Delete this scan and its rooms? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/scans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete scan");
      setScans((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete scan");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">Your scans</h1>
          <p className="mt-2 text-sm text-muted">
            {plan.label} plan
            {plan.maxActiveScans
              ? ` — ${scans.length} / ${plan.maxActiveScans} active scan${plan.maxActiveScans === 1 ? "" : "s"}`
              : ` — ${scans.length} scan${scans.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {atCap ? (
          <Link
            href="/pricing"
            className="border border-blueprint-light px-4 py-2 text-sm hover:bg-blueprint-light/10"
          >
            Upgrade for unlimited scans
          </Link>
        ) : (
          <Link
            href="/scan"
            className="border border-blueprint-light bg-blueprint px-4 py-2 text-sm font-medium hover:bg-blueprint/80"
          >
            New scan
          </Link>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {scans.length === 0 ? (
        <div className="mt-10 border border-dashed border-line px-6 py-16 text-center">
          <p className="font-display text-lg">No scans yet</p>
          <p className="mt-2 text-sm text-muted">
            Photograph a space and Clonify will build a walkable 3D environment.
          </p>
          <Link
            href="/scan"
            className="mt-6 inline-block border border-blueprint-light bg-blueprint px-6 py-3 font-medium hover:bg-blueprint/80"
          >
            Start a scan
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {scans.map((scan) => {
            const href =
              scan.status === "ready"
                ? `/viewer/${scan.id}`
                : `/scan/${scan.id}/processing`;
            const info = ROLE_INFO[scan.role];
            return (
              <li key={scan.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
                <Link href={href} className="min-w-0 flex-1 hover:text-blueprint-light">
                  <p className="font-medium">
                    {scan.placeTitle || `${scan.street}, ${scan.city}`}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {info.label} · {scan._count.rooms} room{scan._count.rooms === 1 ? "" : "s"} ·{" "}
                    {new Date(scan.createdAt).toLocaleDateString()}
                  </p>
                </Link>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      scan.status === "ready"
                        ? "font-mono text-xs text-signal"
                        : scan.status === "error"
                          ? "font-mono text-xs text-danger"
                          : "font-mono text-xs text-amber"
                    }
                  >
                    {scan.status}
                  </span>
                  <Link href={href} className="border border-line px-3 py-1.5 text-sm hover:border-muted">
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(scan.id)}
                    disabled={deletingId === scan.id}
                    className="border border-line px-3 py-1.5 text-sm text-muted hover:border-danger hover:text-danger disabled:opacity-50"
                  >
                    {deletingId === scan.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
