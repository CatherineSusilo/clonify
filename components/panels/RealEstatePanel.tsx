"use client";

import { useState } from "react";

const SWATCHES = ["#F5F1E8", "#DCE3E5", "#2E2E2E", "#8C7B6B", "#A3B18A"];
const MATERIALS = ["Hardwood", "Marble", "Carpet", "Tile"];

export function RealEstatePanel({ scanId }: { scanId: string }) {
  const [wallColor, setWallColor] = useState(SWATCHES[0]);
  const [material, setMaterial] = useState(MATERIALS[0]);
  const [narrating, setNarrating] = useState(false);

  function narrate() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(
      "Entering the main living room. Natural light floods the space, complemented by the newly staged " +
        material.toLowerCase() +
        " flooring and a fresh coat of paint."
    );
    utterance.onend = () => setNarrating(false);
    setNarrating(true);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <div>
        <p className="mb-2 text-sm text-muted">Wall color</p>
        <div className="flex gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => setWallColor(c)}
              className="h-7 w-7 border"
              style={{ backgroundColor: c, borderColor: wallColor === c ? "var(--blueprint-light)" : "transparent" }}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm text-muted">Flooring</p>
        <select
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          className="border border-line bg-ink px-3 py-1.5 text-sm"
        >
          {MATERIALS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col justify-end gap-2">
        <button
          onClick={narrate}
          disabled={narrating}
          className="border border-blueprint-light bg-blueprint px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {narrating ? "Narrating…" : "Play walkthrough narration"}
        </button>
        <a
          href={`/api/scans/${scanId}/report`}
          className="text-center text-sm text-blueprint-light hover:underline"
        >
          Download staged presentation
        </a>
      </div>
    </div>
  );
}
