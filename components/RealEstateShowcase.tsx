"use client";

import { useRef, useState } from "react";

type ModelViewerElement = HTMLElement & { activateAR?: () => void };

export function RealEstateShowcase({ modelUrl, placeName }: { modelUrl: string; placeName: string }) {
  const viewer = useRef<ModelViewerElement>(null);
  const [status, setStatus] = useState("Ready for a client walkthrough.");

  async function enterFullscreen() {
    const element = viewer.current;
    if (!element?.requestFullscreen) {
      setStatus("Fullscreen preview is unavailable in this browser.");
      return;
    }
    await element.requestFullscreen();
    setStatus("Immersive preview is open. Use a headset browser or cast this view for a VR showing.");
  }

  function launchAR() {
    if (!viewer.current?.activateAR) {
      setStatus("Open this tour on an AR-capable phone or headset to place the model in your space.");
      return;
    }
    setStatus("Opening your device’s AR viewer…");
    viewer.current.activateAR();
  }

  async function copyTourLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("Private showcase link copied — ready to send to your client.");
    } catch {
      setStatus("Copy the page URL from your browser to share this showcase.");
    }
  }

  return (
    <section className="border-y border-line bg-ink-soft">
      <div className="mx-auto grid max-w-6xl gap-5 px-6 py-6 lg:grid-cols-[1.3fr_.7fr] lg:items-center">
        <div className="overflow-hidden border border-line bg-black">
          <model-viewer
            ref={viewer}
            suppressHydrationWarning
            src={modelUrl}
            alt={`Interactive 3D showcase of ${placeName}`}
            camera-controls
            auto-rotate
            ar
            ar-modes="webxr scene-viewer quick-look"
            shadow-intensity="1"
            exposure="1"
            style={{ width: "100%", height: "300px" }}
          />
        </div>
        <div>
          <p className="text-sm text-blueprint-light">Client showcase</p>
          <h2 className="mt-1 font-display text-2xl font-medium">Tour the property before the showing.</h2>
          <p className="mt-2 text-sm text-muted">
            Spin the digital twin, place it in AR on a compatible phone or headset, or open a distraction-free immersive preview for a guided presentation.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={launchAR} className="border border-blueprint-light bg-blueprint px-3 py-2 text-sm font-medium text-ink">
              View in AR
            </button>
            <button type="button" onClick={enterFullscreen} className="border border-line px-3 py-2 text-sm hover:border-muted">
              Immersive VR preview
            </button>
            <button type="button" onClick={copyTourLink} className="border border-line px-3 py-2 text-sm hover:border-muted">
              Copy client tour link
            </button>
          </div>
          <p className="mt-3 text-xs text-muted" aria-live="polite">{status}</p>
        </div>
      </div>
    </section>
  );
}
