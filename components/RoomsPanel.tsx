"use client";

import { useMemo, useState } from "react";
import { RoomCaptureModal } from "./RoomCaptureModal";
import { PanoramaViewer } from "./PanoramaViewer";
import { findRoute } from "@/lib/pathfinding";

export type RoomSummary = {
  id: string;
  name: string;
  category: string | null;
  photoKeys: string;
  panoramaKey: string | null;
  connections: string;
};

export function RoomsPanel({
  scanId,
  rooms,
  onRoomsChanged,
}: {
  scanId: string;
  rooms: RoomSummary[];
  onRoomsChanged: () => void;
}) {
  const [activeRoom, setActiveRoom] = useState<RoomSummary | null>(null);
  const [panoramaUrl, setPanoramaUrl] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [addingRoom, setAddingRoom] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [connectingRoomId, setConnectingRoomId] = useState<string | null>(null);
  const [navFrom, setNavFrom] = useState("");
  const [navTo, setNavTo] = useState("");

  const route = useMemo(() => {
    if (!navFrom || !navTo) return undefined;
    return findRoute(rooms, navFrom, navTo);
  }, [rooms, navFrom, navTo]);

  async function viewPanorama(room: RoomSummary) {
    const res = await fetch(`/api/scans/${scanId}/rooms/${room.id}/photos`);
    const data = await res.json();
    if (data.panoramaUrl) setPanoramaUrl(data.panoramaUrl);
  }

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setAddingRoom(true);
    setRoomError(null);
    const res = await fetch(`/api/scans/${scanId}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoomName.trim() }),
    });
    const data = await res.json();
    setAddingRoom(false);
    if (!res.ok) {
      setRoomError(data.error ?? "Could not add room");
      return;
    }
    setNewRoomName("");
    onRoomsChanged();
  }

  async function toggleConnection(room: RoomSummary, otherId: string) {
    const current = new Set(JSON.parse(room.connections || "[]") as string[]);
    if (current.has(otherId)) {
      current.delete(otherId);
    } else {
      current.add(otherId);
    }
    await fetch(`/api/scans/${scanId}/rooms/${room.id}/connections`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectedRoomIds: [...current] }),
    });
    onRoomsChanged();
  }

  return (
    <div className="border border-line bg-ink-soft p-4">
      <p className="mb-3 text-sm text-muted">Rooms</p>
      <ul className="divide-y divide-line">
        {rooms.map((room) => {
          const photoCount = (JSON.parse(room.photoKeys || "[]") as string[]).length;
          const connectionIds = new Set(JSON.parse(room.connections || "[]") as string[]);
          const onRoute = route?.some((r) => r.id === room.id);
          return (
            <li key={room.id} className={onRoute ? "bg-blueprint-light/10" : undefined}>
              <div className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{room.name}</p>
                  <p className="text-xs text-muted">
                    {photoCount > 0 ? `${photoCount} photo(s)` : "Not scanned yet"}
                    {room.panoramaKey ? " · 360° available" : ""}
                    {connectionIds.size > 0 ? ` · connects to ${connectionIds.size} room(s)` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {room.panoramaKey && (
                    <button
                      type="button"
                      onClick={() => viewPanorama(room)}
                      className="border border-line px-3 py-1.5 text-sm hover:border-muted"
                    >
                      View 360°
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConnectingRoomId(connectingRoomId === room.id ? null : room.id)}
                    className="border border-line px-3 py-1.5 text-sm hover:border-muted"
                  >
                    Connect
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRoom(room)}
                    className="border border-blueprint-light px-3 py-1.5 text-sm hover:bg-blueprint-light/10"
                  >
                    Scan this room
                  </button>
                </div>
              </div>
              {connectingRoomId === room.id && (
                <div className="mb-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  {rooms
                    .filter((r) => r.id !== room.id)
                    .map((other) => (
                      <label key={other.id} className="flex items-center gap-1.5 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={connectionIds.has(other.id)}
                          onChange={() => toggleConnection(room, other.id)}
                          className="accent-blueprint"
                        />
                        {other.name}
                      </label>
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {roomError && (
        <p className="mt-3 text-sm text-danger">
          {roomError}{" "}
          <a href="/pricing" className="text-blueprint-light hover:underline">
            See pricing
          </a>
        </p>
      )}
      <form onSubmit={addRoom} className="mt-4 flex gap-2">
        <input
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
          placeholder="Add a room (e.g. Basement)"
          className="flex-1 border border-line bg-ink px-3 py-2 text-sm focus:border-blueprint-light focus:outline-none"
        />
        <button
          type="submit"
          disabled={addingRoom}
          className="border border-line px-3 py-2 text-sm hover:border-muted disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {rooms.length > 1 && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="mb-2 text-sm text-muted">Navigate room to room</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={navFrom}
              onChange={(e) => setNavFrom(e.target.value)}
              className="border border-line bg-ink px-2 py-1.5 text-sm"
            >
              <option value="">From…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <span className="text-muted">→</span>
            <select
              value={navTo}
              onChange={(e) => setNavTo(e.target.value)}
              className="border border-line bg-ink px-2 py-1.5 text-sm"
            >
              <option value="">To…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {route !== undefined && (
            <p className="mt-3 text-sm">
              {route === null ? (
                <span className="text-amber">
                  No connected path yet — use "Connect" on a room to link it to its neighbors.
                </span>
              ) : (
                <span className="text-signal">{route.map((r) => r.name).join(" → ")}</span>
              )}
            </p>
          )}
        </div>
      )}

      {activeRoom && (
        <RoomCaptureModal
          scanId={scanId}
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          onClose={() => setActiveRoom(null)}
          onUploaded={onRoomsChanged}
        />
      )}
      {panoramaUrl && <PanoramaViewer src={panoramaUrl} onClose={() => setPanoramaUrl(null)} />}
    </div>
  );
}
