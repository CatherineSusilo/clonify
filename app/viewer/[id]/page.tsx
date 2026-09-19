"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_INFO, type RoleKey } from "@/lib/roles";
import { FloorPlanPanel, type BuildingFootprint } from "@/components/FloorPlanPanel";
import { RoomsPanel, type RoomSummary } from "@/components/RoomsPanel";
import { RealEstatePanel } from "@/components/panels/RealEstatePanel";
import { DisasterReliefPanel } from "@/components/panels/DisasterReliefPanel";
import { AccessibilityPanel } from "@/components/panels/AccessibilityPanel";
import { MepPanel } from "@/components/panels/MepPanel";

type Scan = {
  id: string;
  role: RoleKey;
  status: string;
  modelUrl: string | null;
  lat: number | null;
  lng: number | null;
  street: string;
  city: string;
  blueprintSource: string | null;
  rooms: RoomSummary[];
};

const ROLE_PANELS: Record<RoleKey, React.ComponentType<{ scanId: string }>> = {
  REAL_ESTATE: RealEstatePanel,
  DISASTER_RELIEF: DisasterReliefPanel,
  ACCESSIBILITY_AUDIT: AccessibilityPanel,
  MEP_ENGINEER: MepPanel,
};

export default function ViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [scan, setScan] = useState<Scan | null>(null);

  const loadScan = useCallback(async () => {
    const res = await fetch(`/api/scans/${id}`);
    const data = await res.json();
    if (!data.scan) {
      router.replace("/scan");
      return;
    }
    if (data.scan.status !== "ready") {
      router.replace(`/scan/${id}/processing`);
      return;
    }
    setScan(data.scan);
  }, [id, router]);

  useEffect(() => {
    loadScan();
  }, [loadScan]);

  if (!scan) {
    return <div className="flex flex-1 items-center justify-center text-muted">Loading…</div>;
  }

  const info = ROLE_INFO[scan.role];
  const Panel = ROLE_PANELS[scan.role];
  const building: BuildingFootprint | null = scan.blueprintSource
    ? JSON.parse(scan.blueprintSource)
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line px-6 py-4">
        <p className="text-sm text-blueprint-light">{info.label}</p>
        <h1 className="font-display text-xl font-medium">
          {scan.street}, {scan.city}
        </h1>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="overflow-hidden border border-line bg-black">
            <model-viewer
              suppressHydrationWarning
              src={scan.modelUrl ?? `/api/scans/${scan.id}/model`}
              alt="3D reconstruction of the scanned space"
              camera-controls
              auto-rotate
              shadow-intensity="1"
              ar
              ar-modes="webxr scene-viewer quick-look"
              style={{ width: "100%", height: "100%", minHeight: "380px" }}
            >
              <button
                slot="ar-button"
                className="absolute bottom-4 right-4 border border-blueprint-light bg-ink px-3 py-1.5 text-sm text-ink-text"
              >
                View in your space (AR)
              </button>
            </model-viewer>
          </div>
          <p className="text-xs text-muted">
            Walkable 3D reconstruction, generated from your photos. Open on a phone to view in AR.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="min-h-[280px]">
            <FloorPlanPanel lat={scan.lat} lng={scan.lng} building={building} />
          </div>
          <RoomsPanel scanId={scan.id} rooms={scan.rooms} onRoomsChanged={loadScan} />
        </div>
      </div>

      <div className="border-t border-line p-6">
        <Panel scanId={scan.id} />
      </div>
    </div>
  );
}
