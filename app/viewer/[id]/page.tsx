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
import { IndoorNavigationPanel } from "@/components/IndoorNavigationPanel";
import { RealEstateShowcase } from "@/components/RealEstateShowcase";

type ReferenceImage = {
  url: string;
  title: string;
  license: string;
  attribution: string;
  source: string;
  width?: number;
  height?: number;
};

type Scan = {
  id: string;
  role: RoleKey;
  status: string;
  modelUrl: string | null;
  lat: number | null;
  lng: number | null;
  street: string;
  city: string;
  placeTitle: string | null;
  blueprintSource: string | null;
  referenceImages: string;
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
  const [hdExports, setHdExports] = useState(false);

  const loadScan = useCallback(async () => {
    const res = await fetch(`/api/scans/${id}`);
    const data = await res.json();
    if (!data.scan) {
      router.replace("/scans");
      return;
    }
    if (data.scan.status !== "ready") {
      router.replace(`/scan/${id}/processing`);
      return;
    }
    setScan(data.scan);
    setHdExports(Boolean(data.plan?.hdExports));
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
  const referenceImages: ReferenceImage[] = JSON.parse(scan.referenceImages || "[]");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-6 py-4">
        <div>
          <p className="text-sm text-blueprint-light">{info.label}</p>
          <h1 className="font-display text-xl font-medium">
            {scan.placeTitle || `${scan.street}, ${scan.city}`}
          </h1>
          {scan.placeTitle && (
            <p className="text-sm text-muted">
              {scan.street}, {scan.city}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          {(hdExports || !scan.modelUrl) && (
            <a
              href={scan.modelUrl ?? `/api/scans/${scan.id}/model`}
              download
              className="border border-line px-3 py-1.5 text-sm hover:border-muted"
            >
              Download GLB
            </a>
          )}
          {!hdExports && scan.modelUrl && (
            <a href="/pricing" className="border border-line px-3 py-1.5 text-sm text-muted hover:border-muted">
              Upgrade for HD export
            </a>
          )}
          <a
            href={`/api/scans/${scan.id}/report`}
            className="border border-line px-3 py-1.5 text-sm hover:border-muted"
          >
            Report PDF
          </a>
        </div>
      </header>

      {scan.role === "REAL_ESTATE" && (
        <RealEstateShowcase
          modelUrl={scan.modelUrl ?? `/api/scans/${scan.id}/model`}
          placeName={scan.placeTitle || `${scan.street}, ${scan.city}`}
        />
      )}

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

          {referenceImages.length > 0 && (
            <div className="border border-line bg-ink-soft p-3 text-xs text-muted">
              <p className="mb-1.5">
                {referenceImages.length} full-size indoor reference photo(s) found for &ldquo;{scan.placeTitle || `${scan.street}, ${scan.city}`}&rdquo; — used to
                help build the 3D reconstruction:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {referenceImages.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- external URLs from Commons/Openverse, not worth an image loader config for small thumbnails
                  <img
                    key={i}
                    src={img.url}
                    alt={img.title}
                    title={`${img.source}: ${img.attribution}, ${img.license}`}
                    className="h-14 w-20 border border-line object-cover"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="min-h-[280px]">
            <FloorPlanPanel lat={scan.lat} lng={scan.lng} building={building} />
          </div>
          <IndoorNavigationPanel rooms={scan.rooms} />
          <RoomsPanel scanId={scan.id} rooms={scan.rooms} onRoomsChanged={loadScan} />
        </div>
      </div>

      <div className="border-t border-line p-6">
        <Panel scanId={scan.id} />
      </div>
    </div>
  );
}
