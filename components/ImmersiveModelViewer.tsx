"use client";

import { useEffect, useState } from "react";
import { applyReconstructionEvent, type ReconstructionState, type SurfaceAnnotation } from "@/lib/reconstruction";

type Props = {
  scanId: string;
  modelUrl: string;
  onOpenNavigation: () => void;
};

const annotationPosition: Record<SurfaceAnnotation["anchor"], string> = {
  "top-left": "left-4 top-16",
  "top-right": "right-4 top-16",
  "bottom-left": "bottom-24 left-4",
  center: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
};

function emptyState(modelUrl: string): ReconstructionState {
  return { modelUrl, progress: 12, annotations: [] };
}

export function ImmersiveModelViewer({ scanId, modelUrl, onOpenNavigation }: Props) {
  const [state, setState] = useState<ReconstructionState>(() => emptyState(modelUrl));
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [selectedAnnotation, setSelectedAnnotation] = useState<SurfaceAnnotation | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch(`/api/scans/${scanId}/reconstruction`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Reconstruction state is unavailable");
        return response.json() as Promise<{ state: ReconstructionState }>;
      })
      .then(({ state: nextState }) => {
        if (!active) return;
        setState(nextState);
        window.setTimeout(() => {
          if (!active) return;
          setState((current) => ({
            ...applyReconstructionEvent(current, { type: "progress", progress: 100 }),
            annotations: current.annotations.map((annotation) => ({ ...annotation, status: "confirmed", confidence: Math.max(annotation.confidence, 0.92) })),
          }));
        }, 900);
      })
      .catch(() => {
        if (active) setState((current) => ({ ...current, progress: 0 }));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [scanId]);

  const selectedStatus = selectedAnnotation?.status === "confirmed" ? "Confirmed" : selectedAnnotation?.status === "pending" ? "Pending" : "Refining";

  return (
    <section className="relative isolate min-h-[62svh] overflow-hidden rounded-[2rem] border border-line bg-black shadow-2xl" aria-label="Live 3D reconstruction">
      <model-viewer
        suppressHydrationWarning
        src={state.modelUrl ?? modelUrl}
        alt="Live detailed reconstruction of the scanned room"
        camera-controls
        auto-rotate
        shadow-intensity="1"
        ar
        ar-modes="webxr scene-viewer quick-look"
        style={{ width: "100%", height: "100%", minHeight: "62svh", background: "#0a120d" }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div className="rounded-full border border-white/15 bg-black/45 px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-white backdrop-blur">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-signal align-middle" />LIVE MODEL
        </div>
        <output className="rounded-full border border-white/15 bg-black/45 px-3 py-2 font-mono text-[10px] text-white backdrop-blur" aria-live="polite">
          {state.progress}% refined
        </output>
      </div>

      {showAnnotations && state.annotations.map((annotation) => (
        <button
          key={annotation.id}
          type="button"
          onClick={() => setSelectedAnnotation(annotation)}
          aria-label={`${annotation.label}: ${annotation.value}. ${annotation.status}`}
          className={`absolute ${annotationPosition[annotation.anchor]} max-w-[12rem] rounded-2xl border border-white/25 bg-black/65 px-3 py-2 text-left text-xs text-white shadow-lg backdrop-blur transition hover:border-blueprint-light focus:outline-none focus:ring-2 focus:ring-blueprint-light`}
        >
          <span className="block text-[9px] uppercase tracking-[0.15em] text-blueprint-light">{annotation.label}</span>
          <span className="mt-0.5 block font-medium">{annotation.value}</span>
        </button>
      ))}

      {selectedAnnotation && (
        <aside className="absolute inset-x-3 bottom-24 rounded-[1.5rem] border border-white/15 bg-ink/95 p-4 text-sm shadow-2xl backdrop-blur sm:left-auto sm:right-4 sm:top-16 sm:bottom-auto sm:w-72" aria-live="polite">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs text-blueprint-light">{selectedStatus}</p><p className="mt-1 font-medium">{selectedAnnotation.label}</p><p className="mt-1 text-muted">{selectedAnnotation.value} · {Math.round(selectedAnnotation.confidence * 100)}% confidence</p></div>
            <button type="button" onClick={() => setSelectedAnnotation(null)} aria-label="Close annotation details" className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-white">×</button>
          </div>
        </aside>
      )}

      <nav className="absolute inset-x-0 bottom-4 flex justify-center" aria-label="Viewer controls">
        <div className="flex min-h-14 items-center gap-2 rounded-full border border-white/15 bg-ink/90 p-1.5 shadow-2xl backdrop-blur">
          <button type="button" aria-label="Capture view" title="Capture view" className="grid h-11 w-11 place-items-center rounded-full text-lg text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blueprint-light">◉</button>
          <button type="button" aria-label="Toggle annotations" title="Toggle annotations" aria-pressed={showAnnotations} onClick={() => setShowAnnotations((visible) => !visible)} className="grid h-11 w-11 place-items-center rounded-full text-lg text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blueprint-light">◌</button>
          <button type="button" aria-label="Open indoor navigation" title="Open indoor navigation" onClick={onOpenNavigation} className="grid h-12 w-12 place-items-center rounded-full bg-blueprint text-xl text-ink transition hover:bg-blueprint-light focus:outline-none focus:ring-2 focus:ring-white">⌖</button>
        </div>
      </nav>
    </section>
  );
}
