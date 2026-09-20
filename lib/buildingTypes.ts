export const BUILDING_TYPES = [
  { value: "museum", label: "Museum", queryTerms: ["museum", "gallery", "exhibition hall"] },
  { value: "school", label: "School", queryTerms: ["school", "campus", "classroom"] },
  { value: "library", label: "Library", queryTerms: ["library", "reading room", "archive"] },
  { value: "hospital", label: "Hospital / clinic", queryTerms: ["hospital", "clinic", "medical center"] },
  { value: "civic", label: "Civic building", queryTerms: ["civic building", "city hall", "government building"] },
  { value: "theater", label: "Theater / performance venue", queryTerms: ["theater", "performing arts center", "auditorium"] },
  { value: "station", label: "Transit station", queryTerms: ["train station", "transit station", "metro station"] },
  { value: "place-of-worship", label: "Place of worship", queryTerms: ["church", "mosque", "temple", "place of worship"] },
  { value: "sports", label: "Sports venue", queryTerms: ["stadium", "arena", "sports center"] },
  { value: "residential", label: "Residential / apartment", queryTerms: ["apartment", "residential building", "house"] },
  { value: "commercial", label: "Commercial / office", queryTerms: ["office", "retail", "commercial building"] },
  { value: "other", label: "Other public or private building", queryTerms: ["building"] },
] as const;

export type BuildingType = (typeof BUILDING_TYPES)[number]["value"];

export function getBuildingType(value: string | null | undefined) {
  return BUILDING_TYPES.find((type) => type.value === value) ?? BUILDING_TYPES[BUILDING_TYPES.length - 1];
}
