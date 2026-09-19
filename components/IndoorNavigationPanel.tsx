"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { findRoute } from "@/lib/pathfinding";
import type { RoomSummary } from "./RoomsPanel";

type Props = {
  rooms: RoomSummary[];
  onSelectRoom?: (roomId: string) => void;
  open?: boolean;
  onClose?: () => void;
  heading?: number | null;
  trackingConfidence?: "available" | "permission-required" | "unavailable";
  motionControl?: ReactNode;
};

const palette = ["#9cffb4", "#72e6ff", "#d1a7ff", "#ffcb6b", "#ff9e9e", "#8de9d0"];

function roomBounds(index: number, count: number) {
  const columns = count <= 4 ? 2 : 3;
  const row = Math.floor(index / columns);
  const column = index % columns;
  const rows = Math.ceil(count / columns);
  const width = 88 / columns;
  const height = 72 / rows;
  return { x: 6 + column * width, y: 14 + row * height, width: width - 3, height: height - 3 };
}

export function IndoorNavigationPanel({ rooms, onSelectRoom, open = true, onClose, heading = null, trackingConfidence = "unavailable", motionControl }: Props) {
  const [from, setFrom] = useState(rooms[0]?.id ?? "");
  const [to, setTo] = useState(rooms[rooms.length - 1]?.id ?? "");
  const [mobilityMode, setMobilityMode] = useState(true);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [activeFloor, setActiveFloor] = useState(rooms[0]?.floor ?? 1);
  const [speaking, setSpeaking] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("Voice guidance is ready.");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const validFrom = rooms.some((room) => room.id === from) ? from : (rooms[0]?.id ?? "");
  const validTo = rooms.some((room) => room.id === to) ? to : (rooms[rooms.length - 1]?.id ?? "");
  const route = useMemo(
    () => (validFrom && validTo ? findRoute(rooms, validFrom, validTo) : undefined),
    [rooms, validFrom, validTo]
  );
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const floors = useMemo(() => [...new Set(rooms.map((room) => room.floor))].sort((a, b) => a - b), [rooms]);
  const visibleRooms = rooms.filter((room) => room.floor === activeFloor);
  const routeSteps = route && route.length > 1 ? route.slice(1).map((room, index) => {
    const previous = route[index];
    return index === route.length - 2
      ? `Arrive at ${room.name} on level ${room.floor}`
      : previous.floor !== room.floor
        ? `Move from ${previous.name}, level ${previous.floor}, to ${room.name}, level ${room.floor} via the connected vertical route`
        : `Continue from ${previous.name} to ${room.name}`;
  }) : [];

  if (rooms.length === 0 || !open) return null;

  function stopGuidance() {
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
    setSpeechStatus("Voice guidance paused.");
  }

  function startGuidance() {
    if (!route || route.length < 2) {
      setSpeechStatus("Choose two connected rooms before starting voice guidance.");
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeechStatus("Voice guidance is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const routeNames = route.map((room) => room.name);
    const announcement = `Starting accessible indoor guidance from ${routeNames[0]}. ${routeSteps.join(". ")}.`;
    const utterance = new SpeechSynthesisUtterance(announcement);
    utterance.rate = 0.92;
    utterance.onend = () => {
      setSpeaking(false);
      setSpeechStatus(`Arrived at ${routeNames[routeNames.length - 1]}.`);
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setSpeechStatus("Voice guidance could not start. Check your browser audio settings.");
    };
    utteranceRef.current = utterance;
    setSpeaking(true);
    setSpeechStatus(`Guiding you to ${routeNames[routeNames.length - 1]}.`);
    window.speechSynthesis.speak(utterance);
  }

  function chooseRoom(id: string) {
    setActiveRoom(id);
    onSelectRoom?.(id);
  }

  return (
    <section className="fixed inset-0 z-40 flex items-end bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true" aria-label="Indoor navigation">
      <div className="max-h-[92svh] w-full overflow-y-auto rounded-t-[2rem] border border-line bg-ink-soft shadow-2xl sm:max-w-5xl sm:rounded-[2rem]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="font-display text-base font-medium">Indoor wayfinding</p>
          <p className="text-xs text-muted">All captured levels · 2D room graph synced to your walkable 3D model</p>
        </div>
        <div className="flex items-center gap-2"><span className="text-xs text-muted">{heading == null ? "Motion unavailable" : `${heading}° heading`} · {trackingConfidence}</span>{motionControl}<button type="button" aria-label="Toggle step-free route" title="Toggle step-free route" aria-pressed={mobilityMode} onClick={() => setMobilityMode((value) => !value)} className={`grid h-11 w-11 place-items-center rounded-full border text-lg ${mobilityMode ? "border-blueprint-light bg-blueprint/20 text-blueprint-light" : "border-line text-muted"}`}>♿</button>{onClose && <button type="button" aria-label="Close indoor navigation" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full text-lg text-muted hover:bg-white/10">×</button>}</div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="relative overflow-hidden border border-line bg-[#07120a]">
          <div className="absolute right-3 top-3 z-10 flex gap-1">
            {floors.map((floor) => (
              <button key={floor} type="button" onClick={() => setActiveFloor(floor)} className={`border px-2 py-1 text-[10px] ${activeFloor === floor ? "border-blueprint-light bg-blueprint/20 text-blueprint-light" : "border-line bg-ink/80 text-muted"}`}>
                L{floor}
              </button>
            ))}
          </div>
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" /> Level {String(activeFloor).padStart(2, "0")} · live map
          </div>
          <svg viewBox="0 0 100 100" role="img" aria-label="Interactive 2D floor plan" className="block aspect-[1.45/1] w-full">
            <defs>
              <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#204a2a" strokeWidth=".18" /></pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
            <path d="M4 10H96V88H4Z" fill="none" stroke="#57d878" strokeWidth="1.2" />
            {visibleRooms.map((room, index) => {
              const box = roomBounds(index, visibleRooms.length);
              const isRoute = route?.some((entry) => entry.id === room.id);
              const selected = activeRoom === room.id;
              return (
                <g key={room.id} onClick={() => chooseRoom(room.id)} className="cursor-pointer">
                  <rect x={box.x} y={box.y} width={box.width} height={box.height} rx="1" fill={palette[index % palette.length]} fillOpacity={selected ? ".72" : isRoute ? ".45" : ".19"} stroke={selected ? "#ffffff" : palette[index % palette.length]} strokeWidth={selected ? "1.2" : ".45"} />
                  <text x={box.x + box.width / 2} y={box.y + box.height / 2 - 1} textAnchor="middle" fill="#e8ffed" fontSize="3.3" fontFamily="sans-serif">{room.name.length > 16 ? `${room.name.slice(0, 15)}…` : room.name}</text>
                  <text x={box.x + box.width / 2} y={box.y + box.height / 2 + 4} textAnchor="middle" fill="#a6d4b1" fontSize="2.2" fontFamily="sans-serif">{room.category ?? "Room"}</text>
                </g>
              );
            })}
            {route && route.length > 1 && route.slice(0, -1).map((room, index) => {
              const nextRoom = route[index + 1];
              if (room.floor !== activeFloor || nextRoom.floor !== activeFloor) return null;
              const a = roomBounds(visibleRooms.findIndex((candidate) => candidate.id === room.id), visibleRooms.length);
              const b = roomBounds(visibleRooms.findIndex((candidate) => candidate.id === nextRoom.id), visibleRooms.length);
              return <path key={`${room.id}-${nextRoom.id}`} d={`M ${a.x + a.width / 2} ${a.y + a.height / 2} L ${b.x + b.width / 2} ${b.y + b.height / 2}`} stroke="#ffffff" strokeWidth=".9" strokeDasharray="2 1.5" opacity=".95" />;
            })}
            <circle cx="8" cy="93" r="1.4" fill="#ffcb6b" /><text x="11" y="94" fill="#ffdf97" fontSize="2.7" fontFamily="sans-serif">Entrance</text>
            <g transform={`rotate(${heading ?? 0} 91 91)`}><path d="M91 84L94 94L91 92L88 94Z" fill="#ffffff" /></g>
          </svg>
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="text-muted">Starting point<select value={validFrom} onChange={(event) => setFrom(event.target.value)} className="mt-1 block w-full border border-line bg-ink px-2 py-2 text-ink-text"><option value="">Choose room</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
            <label className="text-muted">Destination<select value={validTo} onChange={(event) => setTo(event.target.value)} className="mt-1 block w-full border border-line bg-ink px-2 py-2 text-ink-text"><option value="">Choose room</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
          </div>

          <div className="border-y border-line py-3">
            {route === undefined && <p className="text-sm text-muted">Select two rooms to create a route.</p>}
            {route === null && <p className="text-sm text-amber">These rooms are not connected yet. Link neighboring rooms below to create a navigable path.</p>}
            {route && route.length === 1 && <p className="text-sm text-signal">You&apos;re already at {roomById.get(validFrom)?.name}.</p>}
            {routeSteps.length > 0 && <ol className="space-y-2 text-sm">{routeSteps.map((step, index) => <li key={step} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center border border-blueprint-light text-[10px] text-blueprint-light">{index + 1}</span><span>{step}</span></li>)}</ol>}
          </div>

          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <button
              type="button"
              onClick={speaking ? stopGuidance : startGuidance}
              disabled={!speaking && (!route || route.length < 2)}
              className="border border-blueprint-light bg-blueprint px-3 py-2 text-xs font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {speaking ? "Stop voice guidance" : "Start voice guidance"}
            </button>
            <span className="text-xs text-muted">{speechStatus}</span>
          </div>

          <div className="text-xs text-muted">
            <p className="text-signal">{mobilityMode ? "Step-free preference applied" : "Standard indoor route"}</p>
            <p className="mt-1">Route length: {route && route.length > 1 ? `${Math.max(12, (route.length - 1) * 14)} ft · ${Math.max(1, route.length - 1)} transition${route.length > 2 ? "s" : ""}` : "—"}</p>
            {mobilityMode && <p className="mt-1">Verify doorway widths and ramp slopes from the ADA audit before relying on a route.</p>}
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
