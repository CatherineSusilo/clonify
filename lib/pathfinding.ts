export type RoomNode = { id: string; name: string; floor: number; connections: string };

/** Breadth-first search over the room adjacency graph (Room.connections).
 * Returns the room-to-room route as an ordered list, or null if the two
 * rooms aren't connected (directly or via other rooms). */
export function findRoute(rooms: RoomNode[], startId: string, endId: string): RoomNode[] | null {
  if (startId === endId) {
    const room = rooms.find((r) => r.id === startId);
    return room ? [room] : null;
  }

  const byId = new Map(rooms.map((r) => [r.id, r]));
  const queue: string[] = [startId];
  const cameFrom = new Map<string, string>();
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === endId) break;

    const current = byId.get(currentId);
    if (!current) continue;
    const neighbors = JSON.parse(current.connections || "[]") as string[];

    for (const neighborId of neighbors) {
      if (visited.has(neighborId) || !byId.has(neighborId)) continue;
      visited.add(neighborId);
      cameFrom.set(neighborId, currentId);
      queue.push(neighborId);
    }
  }

  if (!visited.has(endId)) return null;

  const path: string[] = [endId];
  let current = endId;
  while (current !== startId) {
    const prev = cameFrom.get(current);
    if (!prev) return null;
    path.push(prev);
    current = prev;
  }
  path.reverse();
  return path.map((id) => byId.get(id)!);
}
