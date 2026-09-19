# Immersive renderer implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first immersive scan viewer that progressively annotates a detailed 3D room model and opens map-style indoor navigation, while supporting local and private-server reconstruction modes through the same API shape.

**Architecture:** A pure reconstruction-state module converts scan metadata and server partial updates into stable, surface-bound annotation data. The viewer consumes a streaming/polling adapter and renders it in an immersive client component; a browser motion source supplies an optional on-device heading for indoor navigation. The current procedural GLB remains the compatible fallback until a local/private open-source worker publishes a real model.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, model-viewer, browser Device Orientation API, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-detail-oriented-immersive-renderer-design.md`

## Global Constraints

- The same reconstruction result contract must work with a local-hosted worker and a private server.
- GPS must not be presented as indoor positioning; use on-device motion heading only when browser permission and confidence are available.
- The primary viewer is immersive, mobile-first, and preserves a 44px minimum target size for every touch control.
- Primary viewer controls use symbols plus accessible names; descriptive text belongs in contextual detail surfaces.
- Annotations must cover wall plane/color, floor type, depth, and architectural openings with a provisional/confirmed/pending status.
- The indoor navigation launcher is round and opens a map-inspired route surface.
- Preserve the existing GLB endpoint as a fallback for scans without a trained reconstruction.

---

## File structure

- Create `lib/reconstruction.ts`: Serializable reconstruction event and annotation types, metadata fallback parsing, and state reducer.
- Create `lib/reconstruction.test.ts`: Unit tests for fallback annotations and event merging.
- Create `app/api/scans/[id]/reconstruction/route.ts`: Authenticated reconstruction-state endpoint with an implementation-neutral response contract.
- Create `components/ImmersiveModelViewer.tsx`: Model canvas, progressive states, overlay annotation controls, detail sheet, and icon dock.
- Create `components/DeviceMotionHeading.tsx`: Permission-gated device orientation adapter which reports heading/confidence without claiming indoor GPS.
- Modify `components/IndoorNavigationPanel.tsx`: Add a map-mode presentation and optional live heading while retaining the existing route graph and voice guidance.
- Modify `app/viewer/[id]/page.tsx`: Replace the legacy inline model-viewer section with the immersive component and connect map launch/state.
- Modify `app/globals.css`: Add focused rounded-control, bottom-sheet, and canvas-overlay styles without altering shared site layout.
- Modify `package.json`: Add Vitest script and development dependency.

## Tasks

### Task 1: Establish a tested reconstruction contract

**Files:**
- Create: `lib/reconstruction.ts`
- Create: `lib/reconstruction.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `ReconstructionState`, `SurfaceAnnotation`, `ReconstructionEvent`, `reconstructionFromMetadata`, and `applyReconstructionEvent`.
- Consumes `Record<string, string | undefined>` metadata from existing scans.

- [ ] **Step 1: Add Vitest and a test command**

```json
"scripts": { "test": "vitest run" },
"devDependencies": { "vitest": "^3.0.0" }
```

- [ ] **Step 2: Write failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import { applyReconstructionEvent, reconstructionFromMetadata } from "./reconstruction";

describe("reconstructionFromMetadata", () => {
  it("creates material, depth, and wall annotations from a scan", () => {
    const state = reconstructionFromMetadata({ wallColorHex: "#e8dfd1", floorColorHex: "#7a5537", roomDepth: "4.6" });
    expect(state.annotations.map((item) => item.kind)).toEqual(expect.arrayContaining(["wall", "floor", "depth"]));
  });
});

describe("applyReconstructionEvent", () => {
  it("upgrades an existing annotation without losing the current model URL", () => {
    const state = reconstructionFromMetadata({ roomDepth: "4" });
    const next = applyReconstructionEvent(state, { type: "annotation", annotation: { ...state.annotations[0], status: "confirmed", confidence: 0.97 } });
    expect(next.modelUrl).toBe(state.modelUrl);
    expect(next.annotations[0].status).toBe("confirmed");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- lib/reconstruction.test.ts`

Expected: FAIL because the module and exports do not exist.

- [ ] **Step 4: Implement the minimal immutable contract**

```ts
export type AnnotationKind = "wall" | "floor" | "depth" | "opening";
export type AnnotationStatus = "provisional" | "confirmed" | "pending";

export type SurfaceAnnotation = {
  id: string; kind: AnnotationKind; label: string; value: string;
  confidence: number; status: AnnotationStatus; anchor: "top-left" | "bottom-left" | "center";
};

export type ReconstructionState = { modelUrl: string | null; progress: number; annotations: SurfaceAnnotation[] };
export type ReconstructionEvent = { type: "progress"; progress: number } | { type: "model"; modelUrl: string } | { type: "annotation"; annotation: SurfaceAnnotation };
```

Implement metadata defaults for wall color, floor material/color, and room depth, then merge events by annotation ID.

- [ ] **Step 5: Run the focused tests and type check**

Run: `npm test -- lib/reconstruction.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/reconstruction.ts lib/reconstruction.test.ts
git commit -m "feat: add reconstruction state contract"
```

### Task 2: Expose the deployment-neutral reconstruction endpoint

**Files:**
- Create: `app/api/scans/[id]/reconstruction/route.ts`
- Test: `lib/reconstruction.test.ts`

**Interfaces:**
- Consumes authenticated scan ID and `scan.metadata`.
- Produces `{ mode: "local" | "private-server"; state: ReconstructionState }`.

- [ ] **Step 1: Extend the failing contract test with a serializable local response fixture**

```ts
it("keeps state JSON-safe for local and private transport adapters", () => {
  const state = reconstructionFromMetadata({ roomDepth: "5.2" });
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
});
```

- [ ] **Step 2: Run the test to verify current behavior**

Run: `npm test -- lib/reconstruction.test.ts`

Expected: PASS after Task 1; this is a regression guard before the route is added.

- [ ] **Step 3: Implement the route with the same ownership guard as the scan route**

```ts
const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
const state = reconstructionFromMetadata(JSON.parse(scan.metadata || "{}"));
state.modelUrl = scan.modelUrl ?? `/api/scans/${scan.id}/model`;
return NextResponse.json({ mode: process.env.RECONSTRUCTION_MODE === "local" ? "local" : "private-server", state });
```

- [ ] **Step 4: Run unit tests, lint, and build**

Run: `npm test -- lib/reconstruction.test.ts && npm run lint && npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/scans/[id]/reconstruction/route.ts lib/reconstruction.test.ts
git commit -m "feat: expose reconstruction state"
```

### Task 3: Build the immersive annotated model viewer

**Files:**
- Create: `components/ImmersiveModelViewer.tsx`
- Modify: `app/globals.css`
- Test: `components/ImmersiveModelViewer.test.tsx`

**Interfaces:**
- Consumes `scanId`, initial `modelUrl`, and `onOpenNavigation(): void`.
- Fetches `GET /api/scans/:id/reconstruction` and applies `ReconstructionEvent` updates to `ReconstructionState`.
- Produces `onOpenNavigation` when the map icon is activated.

- [ ] **Step 1: Write a failing render test for accessible symbol controls**

```tsx
it("exposes accessible capture, annotation, and indoor map controls", async () => {
  render(<ImmersiveModelViewer scanId="scan-1" modelUrl="/model.glb" onOpenNavigation={vi.fn()} />);
  expect(await screen.findByRole("button", { name: "Toggle annotations" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Open indoor navigation" })).toHaveClass("rounded-full");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/ImmersiveModelViewer.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the focused client component**

```tsx
<section className="immersive-viewer" aria-label="Live 3D reconstruction">
  <model-viewer src={state.modelUrl ?? modelUrl} camera-controls auto-rotate />
  <output aria-live="polite">{state.progress}% refined</output>
  {showAnnotations && state.annotations.map((annotation) => <button key={annotation.id} aria-label={`${annotation.label}: ${annotation.value}`} />)}
  <nav aria-label="Viewer controls"><button aria-label="Capture view">◉</button><button aria-label="Toggle annotations">◌</button><button aria-label="Open indoor navigation" onClick={onOpenNavigation}>⌖</button></nav>
</section>
```

Use a rounded mobile bottom dock, surface-bound annotation positions, a detail bottom sheet, `aria-live` progress, and status-specific visual treatment. Do not add word labels to the dock.

- [ ] **Step 4: Add responsive CSS and reduced-motion coverage**

```css
.immersive-viewer__dock { min-height: 44px; border-radius: 9999px; }
@media (max-width: 640px) { .immersive-viewer { min-height: 66svh; } }
@media (prefers-reduced-motion: reduce) { .immersive-viewer * { transition-duration: 0ms !important; } }
```

- [ ] **Step 5: Run viewer tests, lint, and build**

Run: `npm test -- components/ImmersiveModelViewer.test.tsx && npm run lint && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/ImmersiveModelViewer.tsx components/ImmersiveModelViewer.test.tsx app/globals.css
git commit -m "feat: add immersive annotated model viewer"
```

### Task 4: Add on-device heading and map-mode indoor navigation

**Files:**
- Create: `components/DeviceMotionHeading.tsx`
- Modify: `components/IndoorNavigationPanel.tsx`
- Test: `lib/reconstruction.test.ts`

**Interfaces:**
- Produces `heading: number | null` and `confidence: "available" | "permission-required" | "unavailable"` from browser motion APIs.
- Extends `IndoorNavigationPanel` with `open`, `onClose`, `heading`, and `trackingConfidence` props while preserving existing `rooms` and `onSelectRoom` props.

- [ ] **Step 1: Add a failing pure conversion test**

```ts
import { normalizeHeading } from "@/components/DeviceMotionHeading";
it("normalizes device heading to zero through 359 degrees", () => {
  expect(normalizeHeading(-12)).toBe(348);
  expect(normalizeHeading(372)).toBe(12);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/reconstruction.test.ts`

Expected: FAIL because the heading helper does not exist.

- [ ] **Step 3: Implement a permission-gated heading source**

```tsx
export function normalizeHeading(value: number) { return ((Math.round(value) % 360) + 360) % 360; }
window.addEventListener("deviceorientation", (event) => {
  if (typeof event.alpha === "number") onHeading(normalizeHeading(360 - event.alpha));
});
```

Show a symbol-only permission action with an accessible name, and render `Tracking unavailable` in the expanded map only when no heading is available. Never describe the source as GPS.

- [ ] **Step 4: Convert the navigation panel into an expanded map mode**

```tsx
if (!open) return null;
return <section role="dialog" aria-label="Indoor navigation"><button aria-label="Close indoor navigation" onClick={onClose}>×</button><div className="indoor-map"><svg aria-label="Indoor route map">...</svg><span style={{ transform: `rotate(${heading ?? 0}deg)` }}>▲</span></div></section>;
```

Keep existing floor switching, accessible route preference, voice guidance, route steps, and room selection. Move secondary form text into the opened sheet; retain visible route geometry and map markers.

- [ ] **Step 5: Run unit tests, lint, and build**

Run: `npm test -- lib/reconstruction.test.ts && npm run lint && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/DeviceMotionHeading.tsx components/IndoorNavigationPanel.tsx lib/reconstruction.test.ts
git commit -m "feat: add motion-aware indoor navigation"
```

### Task 5: Integrate the viewer page and verify user-visible flows

**Files:**
- Modify: `app/viewer/[id]/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes `ImmersiveModelViewer`, `DeviceMotionHeading`, and the expanded `IndoorNavigationPanel`.
- Produces one primary immersive viewer flow and a map overlay state.

- [ ] **Step 1: Write a failing page-level behavior test**

```tsx
it("opens map mode from the immersive viewer launcher", async () => {
  render(<ViewerPage params={Promise.resolve({ id: "scan-1" })} />);
  await userEvent.click(await screen.findByRole("button", { name: "Open indoor navigation" }));
  expect(await screen.findByRole("dialog", { name: "Indoor navigation" })).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- app/viewer/[id]/page.test.tsx`

Expected: FAIL because page integration does not exist.

- [ ] **Step 3: Replace the legacy inline model viewer with the immersive component**

```tsx
const [navigationOpen, setNavigationOpen] = useState(false);
<ImmersiveModelViewer scanId={scan.id} modelUrl={scan.modelUrl ?? `/api/scans/${scan.id}/model`} onOpenNavigation={() => setNavigationOpen(true)} />
<IndoorNavigationPanel rooms={scan.rooms} open={navigationOpen} onClose={() => setNavigationOpen(false)} heading={heading} trackingConfidence={confidence} />
```

Preserve reports, exports, role-specific panels, floor plan, rooms, and reference images. Remove the duplicate always-visible indoor-navigation panel once the map overlay is connected.

- [ ] **Step 4: Run the full automated suite**

Run: `npm test && npm run lint && npm run build`

Expected: PASS.

- [ ] **Step 5: Manually validate on mobile and desktop**

Check 360px and 1280px viewports: canvas dominates, dock targets are 44px+, annotations remain readable, the map opens/closes, floor switching works, no navigation label claims GPS, and the GLB fallback renders without a trained model.

- [ ] **Step 6: Commit**

```bash
git add app/viewer/[id]/page.tsx app/viewer/[id]/page.test.tsx app/globals.css
git commit -m "feat: integrate immersive indoor navigation"
```
