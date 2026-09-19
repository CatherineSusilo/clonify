"use client";

import { useState } from "react";
import clsx from "clsx";

const RAMPS = [
  { label: "Main entrance ramp", riseIn: 6, runIn: 60 },
  { label: "Rear loading ramp", riseIn: 8, runIn: 72 },
];
const DOORS = [
  { label: "Front door", widthIn: 34 },
  { label: "Restroom door", widthIn: 30 },
];

const MAX_SLOPE_PERCENT = 8.33;
const MIN_DOOR_WIDTH_IN = 32;

export function AccessibilityPanel({ scanId }: { scanId: string }) {
  const [auditOn, setAuditOn] = useState(true);

  const rampResults = RAMPS.map((r) => ({
    ...r,
    slopePercent: (r.riseIn / r.runIn) * 100,
  }));
  const failing = rampResults.filter((r) => r.slopePercent > MAX_SLOPE_PERCENT).length +
    DOORS.filter((d) => d.widthIn < MIN_DOOR_WIDTH_IN).length;
  const score = Math.max(0, 100 - failing * 20);

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted">ADA audit</p>
          <button
            onClick={() => setAuditOn((v) => !v)}
            className={clsx(
              "border px-3 py-1 text-xs",
              auditOn ? "border-blueprint-light bg-blueprint text-ink-text" : "border-line text-muted"
            )}
          >
            {auditOn ? "On" : "Off"}
          </button>
        </div>
        <ul className="divide-y divide-line border-y border-line text-sm">
          {rampResults.map((r) => {
            const fail = auditOn && r.slopePercent > MAX_SLOPE_PERCENT;
            return (
              <li
                key={r.label}
                className={clsx("flex justify-between py-2", fail && "text-danger")}
              >
                <span>{r.label}</span>
                <span className="font-mono">{r.slopePercent.toFixed(1)}% slope</span>
              </li>
            );
          })}
          {DOORS.map((d) => {
            const fail = auditOn && d.widthIn < MIN_DOOR_WIDTH_IN;
            return (
              <li
                key={d.label}
                className={clsx("flex justify-between py-2", fail && "text-danger")}
              >
                <span>{d.label}</span>
                <span className="font-mono">{d.widthIn}&quot; clearance</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 border border-line bg-ink-soft p-4">
        <p className="text-sm text-muted">Compliance score</p>
        <p className="font-display text-4xl font-medium text-blueprint-light">{score}</p>
        <a href={`/api/scans/${scanId}/report`} className="text-sm text-blueprint-light hover:underline">
          Download ADA report
        </a>
      </div>
    </div>
  );
}
