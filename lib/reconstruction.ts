export type AnnotationKind = "wall" | "floor" | "depth" | "opening";
export type AnnotationStatus = "provisional" | "confirmed" | "pending";
export type AnnotationAnchor = "top-left" | "bottom-left" | "center" | "top-right";

export type SurfaceAnnotation = {
  id: string;
  kind: AnnotationKind;
  label: string;
  value: string;
  confidence: number;
  status: AnnotationStatus;
  anchor: AnnotationAnchor;
};

export type ReconstructionState = {
  modelUrl: string | null;
  progress: number;
  annotations: SurfaceAnnotation[];
};

export type ReconstructionEvent =
  | { type: "progress"; progress: number }
  | { type: "model"; modelUrl: string }
  | { type: "annotation"; annotation: SurfaceAnnotation };

type ScanMetadata = Record<string, string | undefined>;

export function reconstructionFromMetadata(metadata: ScanMetadata): ReconstructionState {
  const wallColor = metadata.wallColorHex?.trim() || "#d8d1c5";
  const floorColor = metadata.floorColorHex?.trim() || "#806348";
  const depth = Number(metadata.roomDepth);

  return {
    modelUrl: null,
    progress: 36,
    annotations: [
      { id: "wall", kind: "wall", label: "Wall plane", value: wallColor, confidence: 0.84, status: "provisional", anchor: "top-left" },
      { id: "floor", kind: "floor", label: "Floor finish", value: `Wood tone ${floorColor}`, confidence: 0.78, status: "provisional", anchor: "bottom-left" },
      { id: "depth", kind: "depth", label: "Room depth", value: Number.isFinite(depth) && depth > 0 ? `${depth.toFixed(1)} m` : "Estimating", confidence: Number.isFinite(depth) && depth > 0 ? 0.9 : 0.42, status: "provisional", anchor: "center" },
    ],
  };
}

export function applyReconstructionEvent(state: ReconstructionState, event: ReconstructionEvent): ReconstructionState {
  if (event.type === "progress") return { ...state, progress: Math.max(0, Math.min(100, event.progress)) };
  if (event.type === "model") return { ...state, modelUrl: event.modelUrl };

  const exists = state.annotations.some((annotation) => annotation.id === event.annotation.id);
  return {
    ...state,
    annotations: exists
      ? state.annotations.map((annotation) => annotation.id === event.annotation.id ? event.annotation : annotation)
      : [...state.annotations, event.annotation],
  };
}
