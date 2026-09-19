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
        <p className="mb-2 text-sm text-muted">Detected crack / displacement markers</p>
        <ul className="divide-y divide-line border-y border-line text-sm">
          {CRACKS.map((c) => (
            <li key={c.label} className="flex justify-between py-2">
              <span>{c.label}</span>
              <span className="font-mono text-amber">{c.depthIn}&quot; depth</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          Estimated volumetric mesh displacement:{" "}
          <span className="font-mono text-amber">{volumeDisplacedFt3} ft³</span>
        </p>
      </div>
      <div className="flex flex-col justify-end">
        <a
          href={`/api/scans/${scanId}/report`}
          className="border border-danger bg-danger/20 px-4 py-2 text-center text-sm font-medium hover:bg-danger/30"
        >
          Generate claims summary PDF
        </a>
      </div>
    </div>
  );
}
