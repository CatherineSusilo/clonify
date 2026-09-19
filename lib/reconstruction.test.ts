import { describe, expect, it } from "vitest";
import { applyReconstructionEvent, reconstructionFromMetadata } from "./reconstruction";

describe("reconstructionFromMetadata", () => {
  it("creates wall, floor, and depth annotations from scan metadata", () => {
    const state = reconstructionFromMetadata({
      wallColorHex: "#e8dfd1",
      floorColorHex: "#7a5537",
      roomDepth: "4.6",
    });

    expect(state.annotations.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["wall", "floor", "depth"])
    );
  });
});

describe("applyReconstructionEvent", () => {
  it("confirms an annotation without discarding the current model URL", () => {
    const state = { ...reconstructionFromMetadata({ roomDepth: "4" }), modelUrl: "/api/model.glb" };
    const next = applyReconstructionEvent(state, {
      type: "annotation",
      annotation: { ...state.annotations[0], status: "confirmed", confidence: 0.97 },
    });

    expect(next.modelUrl).toBe("/api/model.glb");
    expect(next.annotations[0]).toMatchObject({ status: "confirmed", confidence: 0.97 });
  });
});
