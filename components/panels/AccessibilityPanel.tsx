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
          <p className="text-xs font-semibold text-zinc-400 uppercase">ADA Audit</p>
          <button
            onClick={() => setAuditOn((v) => !v)}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-semibold",
              auditOn ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400"
            )}
          >
            {auditOn ? "ON" : "OFF"}
          </button>
        </div>
        <ul className="space-y-1 text-sm">
          {rampResults.map((r) => {
            const fail = auditOn && r.slopePercent > MAX_SLOPE_PERCENT;
            return (
              <li
                key={r.label}
                className={clsx(
                  "flex justify-between rounded-lg px-3 py-2",
                  fail ? "bg-red-500/20 text-red-300" : "bg-zinc-900"
                )}
              >
                <span>{r.label}</span>
                <span className="font-mono">{r.slopePercent.toFixed(1)}° slope</span>
              </li>
            );
          })}
          {DOORS.map((d) => {
            const fail = auditOn && d.widthIn < MIN_DOOR_WIDTH_IN;
            return (
              <li
                key={d.label}
                className={clsx(
                  "flex justify-between rounded-lg px-3 py-2",
                  fail ? "bg-red-500/20 text-red-300" : "bg-zinc-900"
                )}
              >
                <span>{d.label}</span>
                <span className="font-mono">{d.widthIn}&quot; clearance</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-zinc-900 p-4">
        <p className="text-xs text-zinc-400 uppercase">Compliance score</p>
        <p className="text-4xl font-bold text-blue-400">{score}</p>
        <a
          href={`/api/scans/${scanId}/report`}
          className="mt-2 text-center text-sm text-indigo-400 underline underline-offset-2"
        >
          Download ADA report
        </a>
      </div>
    </div>
  );
}
