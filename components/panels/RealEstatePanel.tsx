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
        <p className="mb-2 text-xs font-semibold text-zinc-400 uppercase">Wall color</p>
        <div className="flex gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => setWallColor(c)}
              className="h-8 w-8 rounded-full border-2"
              style={{ backgroundColor: c, borderColor: wallColor === c ? "#6366f1" : "transparent" }}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold text-zinc-400 uppercase">Flooring</p>
        <select
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm"
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
          className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {narrating ? "Narrating…" : "▶ Walkthrough narration"}
        </button>
        <a
          href={`/api/scans/${scanId}/report`}
          className="text-center text-sm text-indigo-400 underline underline-offset-2"
        >
          Download staged presentation
        </a>
      </div>
    </div>
  );
}
