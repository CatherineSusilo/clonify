import type { RoleKey } from "./roles";

/** Starting room list per role, so there's something to scan the moment a
 * scan finishes processing. Users can rename, remove, or add rooms freely —
 * this just avoids a blank list on first load. */
export const DEFAULT_ROOMS: Record<RoleKey, { name: string; category: string }[]> = {
  REAL_ESTATE: [
    { name: "Living Room", category: "room" },
    { name: "Kitchen", category: "room" },
    { name: "Bedroom", category: "room" },
    { name: "Bathroom", category: "restroom" },
  ],
  DISASTER_RELIEF: [
    { name: "Entry / Foundation", category: "structural" },
    { name: "Main Living Area", category: "room" },
    { name: "Roof / Attic", category: "structural" },
  ],
  ACCESSIBILITY_AUDIT: [
    { name: "Main Entrance", category: "entrance" },
    { name: "Primary Corridor", category: "corridor" },
    { name: "Restroom", category: "restroom" },
  ],
  MEP_ENGINEER: [
    { name: "Mechanical Room", category: "utility" },
    { name: "Electrical Panel", category: "utility" },
    { name: "Main Corridor", category: "corridor" },
  ],
};
