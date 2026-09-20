"use client";

import { useMemo, useState } from "react";
import { IndoorNavigationPanel } from "./IndoorNavigationPanel";
import { LiveNavigationCamera } from "./LiveNavigationCamera";
import { RealEstateShowcase } from "./RealEstateShowcase";
import type { RoomSummary } from "./RoomsPanel";
import { findRoute } from "@/lib/pathfinding";

const rooms: RoomSummary[] = [
  { id: "entry", name: "Main Entrance", category: "entrance", floor: 1, photoKeys: "[]", panoramaKey: null, connections: '["lobby"]' },
  { id: "lobby", name: "Welcome Lobby", category: "shared", floor: 1, photoKeys: "[]", panoramaKey: null, connections: '["entry","kitchen","lift"]' },
  { id: "kitchen", name: "Designer Kitchen", category: "renovation", floor: 1, photoKeys: "[]", panoramaKey: null, connections: '["lobby","living"]' },
  { id: "living", name: "Sunroom", category: "showcase", floor: 1, photoKeys: "[]", panoramaKey: null, connections: '["kitchen","lift"]' },
  { id: "lift", name: "Accessible Lift", category: "vertical route", floor: 1, photoKeys: "[]", panoramaKey: null, connections: '["lobby","living","suite"]' },
  { id: "suite", name: "Skyline Suite", category: "showcase", floor: 2, photoKeys: "[]", panoramaKey: null, connections: '["lift","terrace"]' },
  { id: "terrace", name: "Viewing Terrace", category: "showcase", floor: 2, photoKeys: "[]", panoramaKey: null, connections: '["suite"]' },
];

type Pov = "blueprint" | "immersive" | "camera";
type Role = "navigator" | "showcase" | "renovation";

const roleCopy: Record<Role, { label: string; title: string; description: string; accent: string }> = {
  navigator: { label: "Wayfinding", title: "Guide every guest, on every floor.", description: "Step-free routes, live position alignment, and voice directions that reroute inside the building.", accent: "Navigate with confidence" },
  showcase: { label: "Real estate", title: "Let the property sell itself.", description: "A shareable digital twin with AR, VR, camera walkthroughs, and a guided route for every showing.", accent: "Make the first visit memorable" },
  renovation: { label: "Renovation", title: "Plan the work before the dust.", description: "Metric capture, issue pins, phase tracking, and a clear view of what changes across the whole building.", accent: "Turn scans into action" },
};

export function ImmersiveWorkspace() {
  const [role, setRole] = useState<Role>("navigator");
  const [pov, setPov] = useState<Pov>("blueprint");
  const [showNavigation, setShowNavigation] = useState(false);
  const route = useMemo(() => {
    const found = findRoute(rooms, "entry", "terrace");
    return found?.map((room) => rooms.find((candidate) => candidate.id === room.id)).filter((room): room is RoomSummary => Boolean(room)) ?? rooms;
  }, []);
  const copy = roleCopy[role];

  return (
    <section className="workspace-section" id="workspace">
      <div className="workspace-heading">
        <div><p className="eyebrow">ONE DIGITAL TWIN · EVERY POINT OF VIEW</p><h2>See the building the way the job demands.</h2><p>{copy.description}</p></div>
        <div className="role-switcher" role="tablist" aria-label="Choose your role">
          {(Object.keys(roleCopy) as Role[]).map((item) => <button key={item} type="button" role="tab" aria-selected={role === item} onClick={() => setRole(item)} className={role === item ? "active" : ""}>{roleCopy[item].label}</button>)}
        </div>
      </div>
      <div className="workspace-grid">
        <div className="workspace-visual">
          <div className="pov-switcher" role="tablist" aria-label="Choose a point of view">
            <button type="button" onClick={() => setPov("blueprint")} className={pov === "blueprint" ? "active" : ""}>⌗ Blueprint</button>
            <button type="button" onClick={() => setPov("immersive")} className={pov === "immersive" ? "active" : ""}>◈ 3D immersive</button>
            <button type="button" onClick={() => setPov("camera")} className={pov === "camera" ? "active" : ""}>◉ Live camera</button>
          </div>
          {pov === "camera" ? <LiveNavigationCamera route={route} onClose={() => setPov("blueprint")} /> : pov === "immersive" ? <RealEstateShowcase modelUrl="/api/demo-building" placeName="Harbour House" /> : <BlueprintPreview rooms={rooms} />}
        </div>
        <aside className="workspace-brief">
          <span className="eyebrow">{copy.label} mode</span><h3>{copy.title}</h3><p>{copy.description}</p>
          <div className="metric-list"><span><strong>12</strong> captured viewpoints</span><span><strong>94%</strong> metric confidence</span><span><strong>3</strong> connected floors</span></div>
          <div className="feature-stack"><span>↗ AR + VR ready</span><span>◉ Camera and smart-glasses input</span><span>⌁ Local AI voice directions</span></div>
          <button type="button" onClick={() => setShowNavigation(true)} className="primary-button w-full">Open full indoor navigator</button>
        </aside>
      </div>
      {showNavigation && <IndoorNavigationPanel rooms={rooms} open onClose={() => setShowNavigation(false)} />}
    </section>
  );
}

function BlueprintPreview({ rooms }: { rooms: RoomSummary[] }) {
  return <div className="blueprint-preview"><div className="blueprint-label">LEVEL 01 · LIVE FLOOR GRAPH</div><svg viewBox="0 0 600 420" role="img" aria-label="Bird's-eye blueprint of Harbour House"><defs><pattern id="blueprint-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#244630" strokeWidth="1" /></pattern></defs><rect width="600" height="420" fill="url(#blueprint-grid)" /><path d="M38 42H560V372H38Z" fill="none" stroke="#8effa8" strokeWidth="3" /><path d="M190 42V205H38M390 42V205H190M390 205H560M190 205V372M390 205V372" fill="none" stroke="#6fd98b" strokeWidth="2" /><path d="M88 124H150V165H88ZM244 90H340V165H244ZM430 86H520V170H430ZM78 250H160V340H78ZM245 238H350V340H245ZM420 250H520V340H420Z" fill="#5cff9d" fillOpacity=".13" stroke="#9effb7" strokeWidth="2" /><path d="M64 215C150 215 205 215 252 215S362 215 430 215S510 215 540 215" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="10 8" /><circle cx="64" cy="215" r="8" fill="#ffcc4d" /><circle cx="540" cy="215" r="8" fill="#5cff9d" /><text x="58" y="105" fill="#d6ffe0" fontSize="14">ENTRY</text><text x="255" y="130" fill="#d6ffe0" fontSize="14">KITCHEN</text><text x="442" y="130" fill="#d6ffe0" fontSize="14">LIVING</text><text x="90" y="295" fill="#d6ffe0" fontSize="14">LOBBY</text><text x="265" y="295" fill="#d6ffe0" fontSize="14">LIFT</text><text x="440" y="295" fill="#d6ffe0" fontSize="14">SUITE</text></svg><div className="blueprint-legend"><span><i className="dot amber" /> Start</span><span><i className="dot green" /> Destination</span><span><i className="line-dashed" /> Accessible route</span><span>{rooms.length} connected rooms</span></div></div>;
}
