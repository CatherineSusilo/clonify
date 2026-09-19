"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_INFO, type RoleKey } from "@/lib/roles";
import { FloorPlanPanel } from "@/components/FloorPlanPanel";
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

  useEffect(() => {
    fetch(`/api/scans/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.scan) {
          router.replace("/scan");
          return;
        }
        if (data.scan.status !== "ready") {
          router.replace(`/scan/${id}/processing`);
          return;
        }
        setScan(data.scan);
      });
  }, [id, router]);

  if (!scan) {
    return <div className="flex flex-1 items-center justify-center text-zinc-500">Loading twin…</div>;
  }

  const info = ROLE_INFO[scan.role];
  const Panel = ROLE_PANELS[scan.role];

  return (
    <div className="flex flex-1 flex-col bg-zinc-950">
      <header className="border-b border-zinc-900 px-6 py-4">
        <p className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">
          {info.sdg} · {info.label}
        </p>
        <h1 className="text-xl font-bold">{scan.street}, {scan.city}</h1>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
          <model-viewer
            src={scan.modelUrl ?? undefined}
            alt="Reconstructed spatial twin"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            style={{ width: "100%", height: "100%", minHeight: "420px" }}
          />
        </div>
        <div className="min-h-[420px]">
          <FloorPlanPanel lat={scan.lat} lng={scan.lng} />
        </div>
      </div>

      <div className="border-t border-zinc-900 bg-zinc-950 p-6">
        <Panel scanId={scan.id} />
      </div>
    </div>
  );
}
