const CRACKS = [
  { label: "North wall, living room", depthIn: 1.8 },
  { label: "Foundation, SE corner", depthIn: 3.2 },
  { label: "Ceiling, kitchen", depthIn: 0.6 },
];

export function DisasterReliefPanel({ scanId }: { scanId: string }) {
  const volumeDisplacedFt3 = CRACKS.reduce((sum, c) => sum + c.depthIn * 4.2, 0).toFixed(1);

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <p className="mb-2 text-xs font-semibold text-zinc-400 uppercase">
          Detected crack / displacement markers
        </p>
        <ul className="space-y-1 text-sm">
          {CRACKS.map((c) => (
            <li key={c.label} className="flex justify-between rounded-lg bg-zinc-900 px-3 py-2">
              <span>{c.label}</span>
              <span className="font-mono text-amber-400">{c.depthIn}&quot; depth</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-zinc-400">
          Estimated volumetric mesh displacement:{" "}
          <span className="font-mono text-amber-400">{volumeDisplacedFt3} ft³</span>
        </p>
      </div>
      <div className="flex flex-col justify-end">
        <a
          href={`/api/scans/${scanId}/report`}
          className="rounded-full bg-red-500/90 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-red-500"
        >
          Generate claims summary PDF
        </a>
      </div>
    </div>
  );
}
