import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImmersiveModelViewer } from "./ImmersiveModelViewer";

describe("ImmersiveModelViewer", () => {
  it("offers symbol-led annotation and indoor navigation controls", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: "local",
        state: { modelUrl: "/model.glb", progress: 36, annotations: [] },
      }),
    }));

    render(<ImmersiveModelViewer scanId="scan-1" modelUrl="/model.glb" onOpenNavigation={vi.fn()} />);

    expect((await screen.findByRole("button", { name: "Toggle annotations" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Open indoor navigation" }).className).toContain("rounded-full");
  });
});
