# Detail-oriented immersive renderer design

## Purpose

Upgrade the scan viewer into a mobile-first, immersive reconstruction experience. It must reveal a space as it is being transformed, attach confident architectural annotations directly to the model, and provide indoor navigation through an icon-led, map-inspired control surface.

The application supports two deployment modes with one consistent user experience:

1. **Local-hosted mode:** capture, motion tracking, inference, reconstruction, annotation, and export stay on the user's machine or private local network. No captured frame leaves that environment.
2. **Private-server mode:** the capture device performs motion tracking and immediate visual feedback locally; a private GPU service performs heavy reconstruction and refinement. Captured frames and derived data are restricted to that private service.

## Architecture

### Shared reconstruction pipeline

Use an open-source, containerized model pipeline so it can execute either locally or in private infrastructure without changing product behavior. The pipeline has four stages:

1. **Motion and frame selection:** on-device visual-inertial motion tracking uses camera frames and motion sensors. GPS is only used outdoors; it is not a source of indoor positioning. The tracker emits pose, heading, quality, and key-frame metadata.
2. **Geometry:** multi-view photogrammetry and neural reconstruction create a progressively refined point/mesh representation from selected frames. The final product is a navigable GLB and aligned room graph.
3. **Semantic detail:** an open-source depth model and segmentation model estimate depth, surface extents, architectural openings, and material regions. Candidate pipeline components are Depth Anything V2 for depth, SAM 2 for segmentation, and a COLMAP/Nerfstudio-based reconstruction worker. Pin versions and perform a license/security review before production release.
4. **Annotation fusion:** combine geometry, semantic masks, color sampling, and confidence into surface-bound annotations: wall plane and dominant color, floor type, estimated room depth, doors, windows, and other architectural features.

Each stage emits versioned partial results. The client renders these immediately rather than waiting for a final model.

### Local and private-server execution

The client chooses a transport adapter at startup:

| Mode | Immediate work | Heavy work | Persistence |
| --- | --- | --- | --- |
| Local-hosted | Motion tracking, frame-quality feedback, provisional overlays | Same local worker/process | Local disk or local network storage |
| Private-server | Motion tracking, frame-quality feedback, provisional overlays | Private GPU worker | Private object storage/database |

Both adapters expose the same job status, partial model, annotation, and export interfaces. This isolates deployment from the viewer components.

## Viewer and interaction design

### Immersive capture canvas

The viewer is the dominant surface on every viewport. It contains:

- a subtle live-capture marker and circular completion indicator;
- progressive geometry: sparse structure, coarse surface, then detailed final render;
- tapable annotations anchored in 3D to their source surface;
- a concise confidence treatment that distinguishes provisional from confirmed details;
- viewpoint modes inside the canvas: first-person walkthrough, model orbit, and top-down indoor map.

Annotations describe walls, color, depth, floor material, door/window openings, and architectural boundaries. They must never obscure the primary spatial detail. Selecting one opens its evidence and confidence in a bottom sheet on mobile or side rail on desktop.

### Icon-led controls

Replace word-heavy primary actions with recognizable symbols and accessible labels/tooltips. The fixed bottom dock contains capture, annotation layers, and indoor navigation. Every interactive target is at least 44 by 44 CSS pixels and uses rounded/circular geometry with a larger radius than existing controls. Text remains available in accessibility labels and contextual detail sheets.

### Indoor navigation

The navigation launcher is a prominent round map-style button. It opens a map-inspired indoor navigation mode rather than a text-heavy panel:

- floor-level chips and a live current-position/heading marker;
- visible route line, start and destination markers, and a concise ETA/distance treatment;
- step-free route preference as an icon state;
- a destination chooser that uses search/list semantics only after the map is opened;
- device-motion tracking feeds heading and position to the map when confidence permits.

The route graph remains aligned with the reconstruction geometry and room connections. Navigation cannot imply GPS-level certainty indoors; it displays tracking confidence and degrades gracefully.

### Responsive behavior

On phones, the render fills the primary viewport and the dock stays reachable by thumb. Annotation details, route setup, and panel content appear in bottom sheets. On tablet/desktop, the same details may occupy a side rail while the canvas remains primary. No core action relies on hover.

## Streaming and recovery

In private-server mode, the client uploads selected frames and pose data incrementally. The server streams progress, partial geometry, annotations, and final exports back to the viewer. If connectivity is unavailable, the client continues local motion tracking and capture quality feedback, queues encrypted/local frames and pose data, and marks server-derived detail as pending. Queued work resumes when the private connection returns.

In local-hosted mode, the same state model applies but every worker call targets the local service. A failed inference stage preserves the last successful partial model and gives the user a recoverable retry state.

## Data contracts

Partial render events carry job version, capture progress, pose quality, model URL or point data, and annotation updates. Each annotation contains an ID, semantic type, 3D anchor, bounds/normal, label data, confidence, source stage, and status (`provisional`, `confirmed`, or `pending`). Indoor-location events carry floor, pose, heading, confidence, and timestamp.

Only finalized GLB, room graph, and report outputs are treated as exportable assets. Provisional geometry and annotations are explicitly labeled in the UI.

## Verification

- Unit-test deployment adapters against identical partial-result fixtures.
- Unit-test annotation projection, confidence states, floor routing, and offline queue/retry behavior.
- Component-test icon controls for keyboard access, accessible names, 44px touch targets, and responsive bottom-sheet/side-rail presentation.
- Integration-test a local-hosted scan with networking disabled to confirm frames, reconstruction, annotations, and export remain local.
- Integration-test private-server capture through loss and recovery of connectivity to confirm tracking continues and queued refinement resumes.
- Manually verify mobile viewport behavior, all three viewpoints, annotation legibility over light/dark walls and floors, and indoor-route accuracy/confidence messaging.
