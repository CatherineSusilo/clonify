"use client";

import Link from "next/link";
import { IndoorNavigationPanel } from "@/components/IndoorNavigationPanel";
import { LeadForm } from "@/components/LeadForm";
import type { RoomSummary } from "@/components/RoomsPanel";

const DEMO_ROOMS: RoomSummary[] = [
  { id: "entry", name: "Main Entrance", category: "entrance", floor: 1, photoKeys: "[]", panoramaKey: null, connections: '["lobby"]' },
  { id: "lobby", name: "Welcome Lobby", category: "lobby", floor: 1, photoKeys: "[]", panoramaKey: null, connections: '["entry", "elevator", "gallery"]' },
  { id: "gallery", name: "Open Gallery", category: "room", floor: 1, photoKeys: "[]", panoramaKey: null, connections: '["lobby"]' },
  { id: "elevator", name: "Accessible Lift", category: "vertical route", floor: 1, photoKeys: "[]", panoramaKey: null, connections: '["lobby", "upstairs"]' },
  { id: "upstairs", name: "Accessible Lift", category: "vertical route", floor: 2, photoKeys: "[]", panoramaKey: null, connections: '["elevator", "suite"]' },
  { id: "suite", name: "Skyline Suite", category: "room", floor: 2, photoKeys: "[]", panoramaKey: null, connections: '["upstairs", "terrace"]' },
  { id: "terrace", name: "Viewing Terrace", category: "room", floor: 2, photoKeys: "[]", panoramaKey: null, connections: '["suite"]' },
];

export default function DemoPage() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-blueprint-light">Interactive demo</p>
          <h1 className="font-display mt-1 text-3xl font-medium">Harbour House · two-level showcase</h1>
          <p className="mt-2 max-w-2xl text-muted">Explore the 3D building, switch maps between floors, and start accessible voice navigation from the main entrance to the viewing terrace.</p>
        </div>
        <Link href="/signup" className="border border-blueprint-light bg-blueprint px-4 py-2 text-sm font-medium text-ink">Create my scan</Link>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="overflow-hidden border border-line bg-black">
          <model-viewer
            suppressHydrationWarning
            src="/api/demo-building"
            alt="Two-level demo building"
            camera-controls
            auto-rotate
            ar
            ar-modes="webxr scene-viewer quick-look"
            shadow-intensity="1"
            exposure="1"
            style={{ width: "100%", height: "520px" }}
          />
        </div>
        <IndoorNavigationPanel rooms={DEMO_ROOMS} />
      </div>

      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        <div className="border border-line bg-ink-soft p-4"><p className="text-blueprint-light">01 · All levels</p><p className="mt-1 text-muted">Switch between Level 1 and Level 2 without leaving the tour.</p></div>
        <div className="border border-line bg-ink-soft p-4"><p className="text-blueprint-light">02 · Accessible path</p><p className="mt-1 text-muted">The demo route uses the lift for its level transition.</p></div>
        <div className="border border-line bg-ink-soft p-4"><p className="text-blueprint-light">03 · AR ready</p><p className="mt-1 text-muted">Use a compatible phone or headset to place the demo building in your space.</p></div>
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-2"><LeadForm kind="demo-contact" title="Talk to us about your building" /><div className="border border-line bg-ink-soft p-5"><h2 className="font-display text-xl">Pilot testing</h2><p className="mt-2 text-sm text-muted">Test the navigation, showcase, and renovation workflows with your own building.</p><Link href="/pilot" className="mt-5 inline-block border border-blueprint-light px-4 py-2">Request a pilot</Link></div></div>
    </div>
  );
}
