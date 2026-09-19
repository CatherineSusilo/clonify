"use client";

import { useState } from "react";
import { RoomCaptureModal } from "./RoomCaptureModal";
import { PanoramaViewer } from "./PanoramaViewer";

export type RoomSummary = {
  id: string;
  name: string;
  category: string | null;
  photoKeys: string;
  panoramaKey: string | null;
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

  async function viewPanorama(room: RoomSummary) {
    const res = await fetch(`/api/scans/${scanId}/rooms/${room.id}/photos`);
    const data = await res.json();
    if (data.panoramaUrl) setPanoramaUrl(data.panoramaUrl);
  }

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setAddingRoom(true);
    await fetch(`/api/scans/${scanId}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoomName.trim() }),
    });
    setNewRoomName("");
    setAddingRoom(false);
    onRoomsChanged();
  }

  return (
    <div className="border border-line bg-ink-soft p-4">
      <p className="mb-3 text-sm text-muted">Rooms</p>
      <ul className="divide-y divide-line">
        {rooms.map((room) => {
          const photoCount = (JSON.parse(room.photoKeys || "[]") as string[]).length;
          return (
            <li key={room.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{room.name}</p>
                <p className="text-xs text-muted">
                  {photoCount > 0 ? `${photoCount} photo(s)` : "Not scanned yet"}
                  {room.panoramaKey ? " · 360° available" : ""}
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
                  onClick={() => setActiveRoom(room)}
                  className="border border-blueprint-light px-3 py-1.5 text-sm hover:bg-blueprint-light/10"
                >
                  Scan this room
                </button>
              </div>
            </li>
          );
        })}
      </ul>

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
