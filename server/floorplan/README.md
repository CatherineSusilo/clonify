# Clonify floor-plan analyzer

Automatic **2D blueprint → walkable grid** conversion — the front end of the
"2D to 3D" pipeline. The walkable grid this produces is what the CBM
compiler extrudes into the building's 3D model.

## What it is

`analyze.py` is a classical, **weights-free** computer-vision pipeline built
on the open-source stack the published floor-plan recognition research uses
(OpenCV, SciPy, scikit-image — the same libraries behind CubiCasa5K,
DeepFloorplan, Raster-to-Vector). It runs anywhere with no model download
and no external API.

Pipeline:

1. **Binarise** (Otsu) → an ink mask (walls + text + furniture + dimensions).
2. **Stroke-thickness filter** — walls are drawn thick; text/furniture/dimension
   marks are thin. A distance transform seeds the thick cores and
   morphological reconstruction keeps only ink components that contain a
   thick core, dropping thin-only clutter.
3. **Directional morphology** — keep long horizontal/vertical runs (walls),
   drop short blobs.
4. **Building-envelope detection** — the walkable area must never spill
   outside the exterior walls. Architectural sheets have a border frame, a
   title block, a compass and a scale bar, so a naive "flood-fill from the
   image edge" mistakes the *sheet frame* for the building and floods the
   whole page. Instead `building_envelope()` strips the sheet frame (a thin
   rectangle spanning the page), closes door/window gaps so the outer wall
   loop is continuous, fills it to a solid footprint, and keeps the largest
   real footprint. The footprint perimeter is then sealed as a wall so the
   robot can never path beyond the exterior.
5. **Downsample** to the cell grid; a cell is blocked if a wall runs through
   it (a thin wall is still a barrier), walkable if it is interior open space.
6. **Connectivity** — keep the largest walkable region plus any wing at least
   a third its size, dropping leaked pockets and sub-cell noise.

For a clean blueprint the upload alone is enough — the analyzer resolves the
plan automatically and asks nothing.

## Both AI and ML, together

Three engines run and are reported in the result's `engines` list:

- **Classical CV perception** (`analyze.py`) — recovers *where* the walls are
  with morphology + the building-envelope logic above. Always on.
- **Local ML** (`ml_segment.py`) — a **weights-free, per-image unsupervised
  ML** model: it runs NumPy **k-means** over pixel features (stroke thickness
  + connected-component size) to *learn* the wall-vs-text split from each
  blueprint, adapting to line weight and scan quality where a fixed threshold
  fails. Its wall mask is **fused** (union) with the classical/ONNX perception
  to raise recall — union only adds barriers, so it can never leak the
  walkable area outside the envelope. On by default; `CLONIFY_LOCAL_ML=0` off.
- **Local AI** (`local_model.py`) — a deterministic rule-based/expert-system
  reasoner that recovers *what* each space is: it classifies every OCR'd room
  label (delivery / common / service / charging / restricted) and its robot
  policy, auto-promotes charging rooms to charging pads, and drops restricted
  spaces (voids, shafts, elevators, mechanical rooms) so they are never
  offered as delivery destinations. No training data, auditable, microseconds.

On top of these, a heavier **optional ONNX deep model** (CubiCasa5K /
DeepFloorplan, see `DL_MODEL.md`) can be dropped in to replace the classical
perception front-end; the local ML and local AI still run alongside it
(`onnx-dl+localml`).

## Usage

```bash
python3 analyze.py --image path/to/blueprint.png --max-dim 72 --cell-size 0.5
# → JSON on stdout: { cols, rows, cellSize, cells, uncertain, confidence, method }
```

The Node server calls this automatically (see
`server/src/services/autoDetect.js`); if Python/OpenCV isn't present it falls
back to a basic in-process threshold so setup still works.

## Install

```bash
pip install -r requirements.txt
```

In Docker the stack is installed from Debian packages (see the root
`Dockerfile`): `python3-opencv python3-scipy python3-skimage python3-numpy`.

## Deep-learning upgrade (optional, wired in)

For higher recall on rough scans, a learned **ONNX** wall/room-boundary
segmentation model can be dropped in — it replaces only wall detection; the
rest of the pipeline is unchanged. Set `CLONIFY_DL_MODEL=/path/model.onnx`
and the analyzer uses it (reporting `"method": "onnx-dl"`), otherwise it
stays classical. CubiCasa5K and Deep Floor Plan Recognition both export to
ONNX. Full instructions: **`DL_MODEL.md`**; runtime deps:
`requirements-dl.txt`; integration is tested in `test_analyze.py`.
