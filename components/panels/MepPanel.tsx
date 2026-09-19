export function MepPanel({ scanId }: { scanId: string }) {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <div className="sm:col-span-2 border border-line bg-ink-soft p-4">
        <p className="mb-2 text-sm text-muted">Clearance heatmap (overlaid on the floor plan above)</p>
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square"
              style={{
                backgroundColor: `hsl(${25 + (i % 6) * 15}, 80%, ${35 + (i % 4) * 8}%)`,
              }}
              title="Clearance heatmap cell"
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-end">
        <a
          href={`/api/scans/${scanId}/report`}
          className="border border-blueprint-light bg-blueprint px-4 py-2 text-center text-sm font-medium hover:bg-blueprint/80"
        >
          Export BIM/CAD report
        </a>
      </div>
    </div>
  );
}
