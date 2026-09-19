"use client";

import { useEffect, useRef } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";

export function PanoramaViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const viewer = new Viewer({
      container: container.current,
      panorama: src,
      loadingTxt: "Loading 360° view…",
      navbar: ["zoom", "fullscreen"],
    });
    return () => viewer.destroy();
  }, [src]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-sm text-muted">360° room view</p>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink-text">
          Close
        </button>
      </div>
      <div ref={container} className="flex-1" />
    </div>
  );
}
