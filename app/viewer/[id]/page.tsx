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
import { ImmersiveModelViewer } from "@/components/ImmersiveModelViewer";
import { DeviceMotionHeading, type TrackingConfidence } from "@/components/DeviceMotionHeading";

type ReferenceImage = {
  url: string;
  title: string;
  license: string;
  attribution: string;
  source: string;
  width?: number;
  height?: number;
};

type BlueprintSheet = {
  url: string;
  title: string;
  kind: string;
  retrievalStatus: string;
  analysis?: { edgePixelRatio?: number; largestContourCorners?: number };
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
  publicBlueprints: string;
  imageAnalysis: string | null;
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
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [trackingConfidence, setTrackingConfidence] = useState<TrackingConfidence>("unavailable");

  const loadScan = useCallback(async () => {
    const res = await fetch(`/api/scans/${id}`);
    const data = await res.json();
    if (res.status === 401) {
      router.replace(`/login?next=/viewer/${id}`);
      return;
    }
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
    const timer = window.setTimeout(() => {
      void loadScan();
    }, 0);
    return () => window.clearTimeout(timer);
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
  const blueprintSheets: BlueprintSheet[] = JSON.parse(scan.publicBlueprints || "[]");

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
          <ImmersiveModelViewer scanId={scan.id} modelUrl={scan.modelUrl ?? `/api/scans/${scan.id}/model`} onOpenNavigation={() => setNavigationOpen(true)} />
          <p className="text-xs text-muted">Live reconstruction refines walls, color, depth, floors, and architectural openings as evidence arrives.</p>

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
          {blueprintSheets.length > 0 && (
            <div className="border border-line bg-ink-soft p-3 text-xs text-muted">
              <p className="mb-1.5 text-blueprint-light">
                Blueprint RAG · {blueprintSheets.filter((sheet) => sheet.retrievalStatus === "analyzed").length}/{blueprintSheets.length} sheets analyzed with OpenCV
              </p>
              <p className="mb-2">
                Retrieved open public drawings are used as geometry evidence for the 3D conversion. Plans establish layout; elevations and sections add height and facade context.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {blueprintSheets.map((sheet, index) => (
                  <a key={`${sheet.url}-${index}`} href={sheet.url} target="_blank" rel="noreferrer" className="border border-line px-2 py-1 hover:border-muted">
                    {sheet.kind} · {sheet.analysis?.largestContourCorners ?? "—"} corners
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="min-h-[280px]">
            <FloorPlanPanel lat={scan.lat} lng={scan.lng} building={building} />
          </div>
          <RoomsPanel scanId={scan.id} rooms={scan.rooms} onRoomsChanged={loadScan} />
        </div>
      </div>

      <IndoorNavigationPanel rooms={scan.rooms} open={navigationOpen} onClose={() => setNavigationOpen(false)} heading={heading} trackingConfidence={trackingConfidence} motionControl={navigationOpen ? <DeviceMotionHeading onHeading={setHeading} onConfidence={setTrackingConfidence} /> : null} />

      <div className="border-t border-line p-6">
        <Panel scanId={scan.id} />
      </div>
    </div>
  );
}
