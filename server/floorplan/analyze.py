#!/usr/bin/env python3
"""
Clonify floor-plan analyzer — automatic 2D blueprint -> walkable grid.

This is the "2D to 3D conversion" front-end: it turns an uploaded raster
floor plan into the walkable-cell grid that the CBM compiler extrudes into
the building's 3D model. It is built on OpenCV (opencv-python-headless) and
SciPy — the same open-source computer-vision stack the published floor-plan
recognition research is built on (e.g. CubiCasa5K, "Deep Floor Plan
Recognition…", Raster-to-Vector). It uses the classical, weights-free
pipeline from that literature so it runs anywhere with no model download:

  1. normalise + binarise (Otsu) to an "ink" mask (walls+text+furniture)
  2. isolate WALLS by keeping only long, thin, straight ink structures via
     directional morphological opening (horizontal SE ∪ vertical SE) and
     dropping compact blobs — this removes text labels, dimension marks and
     furniture symbols, which is exactly where the naive per-cell ink
     threshold failed
  3. find the building INTERIOR by flood-filling "outside" from the image
     border, so only space inside the envelope is considered
  4. walkable = interior AND NOT wall; downsample to a cell grid
  5. keep the main connected walkable region; everything else is a
     candidate for a targeted question rather than a silent guess

The design goal: the upload alone is enough — the model resolves the plan
automatically and does not ask the operator anything. Room segmentation
takes ALL interior free space (envelope minus walls) as navigable, so every
enclosed room is reachable and door gaps in the walls provide connectivity;
`uncertain` is therefore always empty. This follows the standard floor-plan
vectorization pipeline in the research (Liu et al., "Raster-to-Vector",
ICCV 2017; Kalervo et al., "CubiCasa5K", 2019; Zeng et al., "Deep Floor
Plan Recognition", 2019; de las Heras et al., wall/floor segmentation):
detect walls, segment enclosed regions into rooms, then extrude to 3D — a
blueprint-only method that needs no photographs.

A deep-learning upgrade (a CubiCasa5K / DeepFloorplan segmentation model)
can be dropped in behind the same JSON contract when weights are provisioned
— see analyze_dl() stub — without changing the server or UI.

Usage:
  python3 analyze.py --image PATH [--max-dim 72] [--cell-size 0.5]
Emits a single JSON object on stdout.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

import cv2
import numpy as np
from scipy import ndimage
from skimage.morphology import reconstruction


def load_gray(path, work_max=1600):
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("could not read image")
    h, w = img.shape
    scale = min(1.0, work_max / max(h, w))
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def wall_mask(gray):
    """Binary mask of wall pixels (True = wall), text/furniture removed."""
    # Otsu binarisation → ink (dark) = True. Blur first to steady the threshold.
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _, ink_img = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    ink = ink_img > 0

    H, W = gray.shape

    # --- stroke-thickness filter -------------------------------------------
    # Walls are drawn as thick (often double) lines; text, dimension marks and
    # furniture symbols are thin. The distance transform gives each ink
    # pixel's distance to background ≈ half its local stroke thickness. Seed
    # only the thick cores, then morphologically reconstruct the full ink
    # components that contain a thick core — this keeps whole walls while
    # dropping components that are thin everywhere (text / furniture).
    dist = cv2.distanceTransform(ink_img, cv2.DIST_L2, 3)
    thickness_seed = max(2.0, min(H, W) * 0.0025)  # px; walls ≳ 2*seed thick
    seeds = (dist >= thickness_seed) & ink
    if seeds.any():
        rec = reconstruction(seeds.astype(np.uint8), ink.astype(np.uint8), method="dilation")
        ink = rec > 0

    # Length of the directional structuring element scales with image size so
    # it keeps genuine wall runs and discards short thick blobs.
    L = max(12, int(min(H, W) * 0.05))
    ink_u8 = (ink.astype(np.uint8)) * 255
    hor = cv2.morphologyEx(ink_u8, cv2.MORPH_OPEN,
                           cv2.getStructuringElement(cv2.MORPH_RECT, (L, 1)))
    ver = cv2.morphologyEx(ink_u8, cv2.MORPH_OPEN,
                           cv2.getStructuringElement(cv2.MORPH_RECT, (1, L)))
    walls = ((hor > 0) | (ver > 0))

    # Re-thicken slightly so 1px lines become solid barriers, then bridge
    # small gaps that opening introduced along a wall.
    walls_u8 = (walls.astype(np.uint8)) * 255
    walls_u8 = cv2.morphologyEx(walls_u8, cv2.MORPH_CLOSE,
                                cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    walls_u8 = cv2.dilate(walls_u8,
                          cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    return walls_u8 > 0


def building_envelope(walls):
    """Solid mask of the building's footprint — the area inside the main
    exterior walls — traced from the actual outer wall CONTOUR so it follows
    the building's real (concave) outline instead of ballooning to the bounding
    box. This is what stops the walkable area leaking outside the exterior
    walls on ornate plans (towers, bays, courtyards).

      1. strip the sheet border frame (a thin page-spanning rectangle) and dust,
      2. lightly close only door-sized gaps so the outer wall loop is continuous
         without bridging across open space,
      3. take the LARGEST external contour of the wall structure (the building
         outline; FloorplanToBlender3D's "biggest contour = floor boundary")
         and fill it — a concave-accurate footprint, not a fill-holes blob.
    """
    H, W = walls.shape

    # 1. Strip the sheet border frame + dust.
    lbl, n = ndimage.label(walls)
    cleaned = np.zeros_like(walls, dtype=bool)
    for c in range(1, n + 1):
        comp = lbl == c
        area = int(comp.sum())
        ys, xs = np.where(comp)
        bw = xs.max() - xs.min() + 1
        bh = ys.max() - ys.min() + 1
        fill_ratio = area / float(bw * bh)
        if bw > 0.9 * W and bh > 0.9 * H and fill_ratio < 0.35:   # sheet frame
            continue
        if area < min(H, W) * 0.5:                                # dust
            continue
        cleaned |= comp

    # keep the biggest wall cluster (the building) — drop far-flung stray runs
    lblc, nc = ndimage.label(cleaned)
    if nc > 1:
        sizes = ndimage.sum(np.ones_like(lblc), lblc, index=range(1, nc + 1))
        biggest = float(sizes.max())
        keep = {i + 1 for i, s in enumerate(sizes) if s >= biggest * 0.06}
        cleaned = np.isin(lblc, list(keep))
    if not cleaned.any():
        cleaned = walls.astype(bool)

    # 2. Light close — only bridge door-sized gaps (~1% of the page), not the
    #    wide open span between wings, which is what caused the over-fill.
    k = max(3, int(min(H, W) * 0.01))
    closed = cv2.morphologyEx((cleaned.astype(np.uint8)) * 255, cv2.MORPH_CLOSE,
                              cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))

    # 3. Largest external contour → filled footprint (follows the real outline).
    cnts, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best, best_area = None, 0.0
    for cnt in cnts:
        area = cv2.contourArea(cnt)
        x, y, bw, bh = cv2.boundingRect(cnt)
        if bw > 0.97 * W and bh > 0.97 * H:   # the sheet itself
            continue
        if area < 0.02 * H * W:               # too small to be the building
            continue
        if area > best_area:
            best_area, best = area, cnt
    if best is None:
        return None
    env = np.zeros((H, W), np.uint8)
    cv2.drawContours(env, [best], -1, 1, thickness=cv2.FILLED)
    # close the footprint over interior courtyards the outline may have notched
    env = cv2.morphologyEx(env, cv2.MORPH_CLOSE,
                           cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    return env.astype(bool)


def _perimeter(mask, thick=None):
    """The boundary ring of a solid mask (mask minus its erosion)."""
    H, W = mask.shape
    t = thick or max(2, int(min(H, W) * 0.004))
    er = cv2.erode((mask.astype(np.uint8)) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (t, t)))
    return mask & (er == 0)


def _border_interior(walls):
    """Fallback envelope: flood-fill outside from the image border. Used only
    when no building footprint is found (e.g. a cropped plan with no frame)."""
    free = ~walls
    lbl, _ = ndimage.label(free)
    border_labels = set(lbl[0, :]).union(lbl[-1, :]).union(lbl[:, 0]).union(lbl[:, -1])
    border_labels.discard(0)
    outside = np.isin(lbl, list(border_labels))
    return free & ~outside


def interior_mask(walls, env=None):
    """True where a pixel is navigable interior: inside the building footprint,
    just inside the exterior walls, and not on a wall."""
    if env is None:
        env = building_envelope(walls)
    if env is None or env.sum() == 0:
        return _border_interior(walls)
    # stay strictly inside the exterior walls
    inner = cv2.erode((env.astype(np.uint8)) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))) > 0
    return inner & (~walls)


# A cell is dropped from the walkable grid only when it is *majority* wall
# (a solid/exterior wall). Thin interior partitions no longer remove the whole
# cell — instead they block the EDGE between the two cells they separate (see
# wall_edges), so rooms stay fully walkable but the robot still can't drive
# through a wall. This edge-blocking occupancy model is the standard fix for
# thin walls being lost at grid resolution.
WALL_CELL_SOLID = 0.6


def wall_filter_watershed(gray):
    """Interior-partition wall recall via a distance-transform watershed — the
    method FloorplanToBlender3D uses. Complements the directional-morphology
    wall mask by catching thin walls between rooms. Returns a boolean mask."""
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    k = np.ones((3, 3), np.uint8)
    opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, k, iterations=2)
    sure_bg = cv2.dilate(opening, k, iterations=3)
    dist = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    if dist.max() <= 0:
        return np.zeros(gray.shape, bool)
    _, sure_fg = cv2.threshold(dist, 0.4 * dist.max(), 255, 0)
    unknown = cv2.subtract(sure_bg, sure_fg.astype(np.uint8))
    return (unknown > 0) & (thresh > 0)


def wall_edges(walls, cols, rows, thresh=0.34):
    """For each grid cell decide whether a wall runs along its right and bottom
    boundary, i.e. whether the robot is blocked from crossing into that
    neighbour. Returns (blocked_right, blocked_down) as rows×cols uint8 grids.
    A wall counts if it spans at least `thresh` of the shared boundary, so even
    a thin partition blocks passage without erasing either room's cells."""
    H, W = walls.shape
    ys = np.linspace(0, H, rows + 1).astype(int)
    xs = np.linspace(0, W, cols + 1).astype(int)
    br = np.zeros((rows, cols), np.uint8)
    bd = np.zeros((rows, cols), np.uint8)
    band = max(1, int(round(min(H, W) * 0.004)))
    for gy in range(rows):
        y0, y1 = ys[gy], max(ys[gy] + 1, ys[gy + 1])
        for gx in range(cols):
            x0, x1 = xs[gx], max(xs[gx] + 1, xs[gx + 1])
            if gx < cols - 1:
                xb = xs[gx + 1]
                strip = walls[y0:y1, max(0, xb - band):min(W, xb + band + 1)]
                if strip.shape[0] and strip.any(axis=1).mean() >= thresh:
                    br[gy, gx] = 1
            if gy < rows - 1:
                yb = ys[gy + 1]
                strip = walls[max(0, yb - band):min(H, yb + band + 1), x0:x1]
                if strip.shape[1] and strip.any(axis=0).mean() >= thresh:
                    bd[gy, gx] = 1
    return br, bd


def _fit_circle(pts):
    """Algebraic (Kåsa) circle fit. pts: Nx2 (x,y). Returns (cx, cy, r, rms)."""
    x = pts[:, 0].astype(np.float64)
    y = pts[:, 1].astype(np.float64)
    A = np.c_[2 * x, 2 * y, np.ones(len(x))]
    b = x ** 2 + y ** 2
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    cx, cy = sol[0], sol[1]
    r = float(np.sqrt(max(0.0, sol[2] + cx ** 2 + cy ** 2)))
    rad = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    rms = float(np.sqrt(np.mean((rad - r) ** 2))) if r > 0 else 1e9
    return cx, cy, r, rms


def _arc_span(cx, cy, pts):
    """Angular span (radians) covered by the points around (cx, cy)."""
    ang = np.sort(np.arctan2(pts[:, 1] - cy, pts[:, 0] - cx))
    if len(ang) < 2:
        return 0.0
    gaps = np.diff(ang)
    gaps = np.append(gaps, ang[0] + 2 * np.pi - ang[-1])
    return float(2 * np.pi - gaps.max())


def detect_doors(gray, walls, cols, rows, cell_size):
    """Detect hinged-door symbols — the quarter-circle *swing arc* an architect
    draws for each door. A door arc is a thin curved stroke whose radius equals
    the door leaf (~0.7–1.1 m) and which spans roughly a quarter turn. Filtering
    on radius + arc span + circular-fit quality keeps genuine door swings and
    rejects curved *walls* (round towers / bay windows), which are thick and
    have a much larger radius. Returns a list of { x, y, radiusM } grid cells at
    each door's hinge."""
    H, W = gray.shape
    _, ink_img = cv2.threshold(cv2.GaussianBlur(gray, (3, 3), 0), 0, 255,
                               cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    ink = ink_img > 0
    # Keep CURVED strokes: remove long straight wall runs (horizontal ∪ vertical
    # openings) — a door swing arc is curved and survives, while straight walls
    # drop out. (Subtracting the fused wall mask would erase the arc, since the
    # watershed/ML passes tend to absorb it.)
    L = max(10, int(min(H, W) * 0.03))
    hor = cv2.morphologyEx(ink_img, cv2.MORPH_OPEN,
                           cv2.getStructuringElement(cv2.MORPH_RECT, (L, 1)))
    ver = cv2.morphologyEx(ink_img, cv2.MORPH_OPEN,
                           cv2.getStructuringElement(cv2.MORPH_RECT, (1, L)))
    straight = cv2.dilate(((hor > 0) | (ver > 0)).astype(np.uint8) * 255,
                          cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    thin = (ink & (straight == 0)).astype(np.uint8) * 255

    # Work in *cells*, not absolute metres — the drawing's real scale is unknown
    # but a door leaf is ~1–3 grid cells (cellSize metres) wide, so a cell-
    # relative radius is scale-invariant and separates doors from big curved
    # walls (round towers span many cells).
    ppc = ((W / cols) + (H / rows)) / 2.0  # pixels per grid cell
    rmin, rmax = 0.7 * ppc, 3.5 * ppc
    cnts, _ = cv2.findContours(thin, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    doors = []
    for c in cnts:
        pts = c[:, 0, :]
        if len(pts) < 12:
            continue
        alen = cv2.arcLength(c, False)
        if alen < 0.8 * ppc or alen > 9.0 * ppc:
            continue
        cx, cy, r, rms = _fit_circle(pts)
        if r < rmin or r > rmax:
            continue
        if rms > 0.14 * r:          # must sit tightly on a circle → it's an arc
            continue
        span = _arc_span(cx, cy, pts)
        if not (np.radians(45) < span < np.radians(160)):  # ~quarter turn
            continue
        gx = int(min(cols - 1, max(0, cx / W * cols)))
        gy = int(min(rows - 1, max(0, cy / H * rows)))
        # de-dupe doors that snap to the same/adjacent cell
        if any(abs(d["x"] - gx) <= 1 and abs(d["y"] - gy) <= 1 for d in doors):
            continue
        doors.append({"x": gx, "y": gy, "radiusM": round(r / ppc * cell_size, 2)})
        if len(doors) >= 200:
            break
    return doors


def to_grid(interior, walls, cols, rows):
    """Downsample pixel masks to a cols×rows walkable grid + wall fraction."""
    H, W = walls.shape
    walk = np.zeros((rows, cols), dtype=np.uint8)
    wall_frac = np.zeros((rows, cols), dtype=np.float32)
    ys = np.linspace(0, H, rows + 1).astype(int)
    xs = np.linspace(0, W, cols + 1).astype(int)
    for gy in range(rows):
        for gx in range(cols):
            y0, y1 = ys[gy], max(ys[gy] + 1, ys[gy + 1])
            x0, x1 = xs[gx], max(xs[gx] + 1, xs[gx + 1])
            cell_w = walls[y0:y1, x0:x1]
            cell_i = interior[y0:y1, x0:x1]
            tot = cell_w.size or 1
            wf = float(cell_w.sum()) / tot
            interior_frac = float(cell_i.sum()) / tot
            wall_frac[gy, gx] = wf
            # Walkable only if the cell is interior open space AND no wall runs
            # through it. A thin wall still blocks the cell (barrier, not area).
            walk[gy, gx] = 1 if (interior_frac >= 0.5 and wf < WALL_CELL_SOLID) else 0
    return walk, wall_frac


def analyze(path, max_dim=72, cell_size=0.5):
    gray = load_gray(path)
    H, W = gray.shape
    aspect = W / H
    if aspect >= 1:
        cols = max_dim
        rows = max(4, int(round(max_dim / aspect)))
    else:
        rows = max_dim
        cols = max(4, int(round(max_dim * aspect)))

    # Wall detection: a learned ONNX segmenter if one is configured (higher
    # recall on rough scans), otherwise the classical CV pipeline. Everything
    # after this is identical, so the DL model is a drop-in upgrade. Any issue
    # in the optional DL path falls back to classical — it can never break
    # the default analyzer.
    seg = None
    try:
        from dl_segment import get_dl_segmenter
        seg = get_dl_segmenter()
    except Exception:  # noqa: BLE001
        seg = None
    engines = []
    if seg is not None:
        walls = seg.wall_mask(gray)
        method = 'onnx-dl'
        engines.append('onnx-dl')
    else:
        walls = wall_mask(gray)
        method = 'opencv-classical'
        engines.append('opencv-classical')

    # Local ML (unsupervised k-means, weights-free) runs *together* with the
    # perception above and its wall pixels are fused in — a second, per-image
    # learned opinion that raises wall recall on ornate/rough plans. Fusion is
    # a union, so it can only add barriers, never leak the walkable area out.
    try:
        from ml_segment import get_local_ml_segmenter
        ml = get_local_ml_segmenter()
        if ml is not None:
            ml_walls = ml.wall_mask(gray)
            walls = walls | ml_walls
            method = method + '+localml'
            engines.append(ml.name)
    except Exception:  # noqa: BLE001
        pass

    # Watershed wall recall (FloorplanToBlender3D method) for interior
    # partition walls, unioned in so thin room dividers become barriers.
    try:
        ws = wall_filter_watershed(gray)
        walls = walls | ws
        method = method + '+watershed'
        engines.append('watershed-fp2b')
    except Exception:  # noqa: BLE001
        pass

    # Find the building footprint and seal its perimeter as a wall, so the
    # exterior is a closed barrier the walkable area can never spill past.
    env = building_envelope(walls)
    if env is not None and env.sum() > 0:
        walls = walls | _perimeter(env)
    interior = interior_mask(walls, env)
    _, wall_frac = to_grid(interior, walls, cols, rows)

    # --- room segmentation + edge-blocking (no user questions) -------------
    # Following the floor-plan vectorization literature (Raster-to-Vector,
    # ICCV'17; CubiCasa5K'19; FloorplanToBlender3D), the interior is fully
    # navigable; a cell is only dropped when it is *majority* wall (solid /
    # exterior). Thin interior partitions instead block the EDGE between the
    # two cells they separate, so rooms stay whole and connected through doors
    # while the robot still cannot cross a wall.
    interior_grid = _interior_grid(interior, cols, rows)
    walk = np.where(interior_grid & (wall_frac < WALL_CELL_SOLID), 1, 0).astype(np.uint8)

    # Keep the connected floor: the largest walkable region plus any region at
    # least a third its size (separate wings joined by doors), and drop the
    # rest (leaked exterior pockets, sub-cell noise).
    lbl, n = ndimage.label(walk, structure=np.array([[1, 1, 1], [1, 1, 1], [1, 1, 1]]))
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lbl), lbl, index=range(1, n + 1))
        biggest = float(sizes.max())
        keep = {i + 1 for i, s in enumerate(sizes) if s >= max(2, biggest * 0.33)}
        walk = np.where(np.isin(lbl, list(keep)), 1, 0).astype(np.uint8)
    elif n == 1:
        if int((lbl == 1).sum()) < 2:
            walk[:] = 0

    # Wall edges between adjacent cells (only meaningful between walkable ones).
    blocked_right, blocked_down = wall_edges(walls, cols, rows)
    blocked_right = np.where(walk == 1, blocked_right, 0).astype(np.uint8)
    blocked_down = np.where(walk == 1, blocked_down, 0).astype(np.uint8)

    # Doors: find the quarter-circle swing symbols and OPEN the wall edges at
    # each doorway, so the robot can drive through and the 3D view shows a gap
    # in the partition instead of a solid wall.
    doors = []
    try:
        doors = detect_doors(gray, walls, cols, rows, cell_size)
        for d in doors:
            dx, dy = d["x"], d["y"]
            for ny in range(max(0, dy - 1), min(rows, dy + 2)):
                for nx in range(max(0, dx - 1), min(cols, dx + 2)):
                    blocked_right[ny, nx] = 0
                    blocked_down[ny, nx] = 0
                    if nx > 0:
                        blocked_right[ny, nx - 1] = 0
                    if ny > 0:
                        blocked_down[ny - 1, nx] = 0
        if doors:
            engines.append('door-arc-detect')
    except Exception:  # noqa: BLE001
        doors = []

    uncertain = []  # the model resolves everything automatically now
    reachable = int(walk.sum())
    confidence = round(reachable / max(1, int(interior_grid.sum())), 3)

    # Read room labels off the plan → auto delivery points (see ocr_labels).
    # Restricted to inside the footprint so title-block / compass / scale text
    # never becomes a bogus delivery point.
    pois = ocr_labels(gray, cols, rows, walk, env=env)
    # The rule-based local AI (local_model.py) classified the POIs inside
    # ocr_labels; record it as an active engine for transparency.
    if any('category' in p for p in pois):
        engines.append('local-ai-rules')

    # Shapely vectorization: clean exterior footprint + room polygons (real
    # shape, areas, centroids). Optional — skipped if Shapely isn't installed.
    footprint, rooms = None, []
    try:
        import vectorize as _vec
        if _vec.available():
            footprint, rooms = _vec.vectorize(env, walls, cols, rows, cell_size)
            pois = _vec.anchor_pois(pois, rooms, cell_size, walk)
            engines.append('shapely-vector')
    except Exception:  # noqa: BLE001
        pass

    return {
        "cols": cols,
        "rows": rows,
        "cellSize": cell_size,
        "cells": walk.flatten().astype(int).tolist(),
        # edge-blocking: 1 = a wall separates this cell from its right / bottom
        # neighbour, so the robot cannot cross even though both cells are walkable
        "blockedRight": blocked_right.flatten().astype(int).tolist(),
        "blockedDown": blocked_down.flatten().astype(int).tolist(),
        "doors": doors,           # [{x, y, radiusM}] detected door swings
        "pois": pois,
        "footprint": footprint,   # exterior outline polygon (metres), or null
        "rooms": rooms,           # [{polygon, areaM2, centroid}]
        "uncertain": uncertain,
        "confidence": confidence,
        "method": method,
        "engines": engines,
    }


def _good_label(text):
    """Accept only strings that read like a room name, so OCR noise from
    dimension marks, hatching and the title block doesn't become a delivery
    point. Requires ≥3 letters and a high alphabetic ratio."""
    letters = sum(ch.isalpha() for ch in text)
    alnum = sum(ch.isalnum() for ch in text)
    if letters < 3 or len(text) < 3:
        return False
    if alnum / max(1, len(text)) < 0.6:
        return False
    # reject strings that are mostly a single repeated char or have no vowel
    if not any(v in text.upper() for v in "AEIOU"):
        return False
    return True


def ocr_labels(gray, cols, rows, walk, min_conf=60, env=None):
    """Read room labels off the blueprint (the text the wall filter strips)
    and turn each into a delivery-point candidate, so clients don't have to
    place and name delivery points by hand. Uses the Tesseract CLI (sparse-
    text page mode) if it is installed; returns [] otherwise. Words outside the
    building footprint (title block, compass, scale bar) are ignored, and each
    label is snapped to the nearest walkable cell so the point sits somewhere
    the robot can actually stop.
    """
    if not shutil.which("tesseract"):
        return []
    H, W = gray.shape

    # Upscale for OCR: small room labels read far better when enlarged, and a
    # light sharpen helps faint engineering-drawing text. OCR only — the grid
    # is unaffected.
    scale = 1.8 if max(H, W) < 2000 else 1.0
    ocr_img = gray
    if scale != 1.0:
        ocr_img = cv2.resize(gray, (int(W * scale), int(H * scale)), interpolation=cv2.INTER_CUBIC)

    # Two page-segmentation modes merged: PSM 11 (sparse text anywhere) catches
    # scattered room names; PSM 6 (uniform block) recovers labels PSM 11 misses.
    lines = {}
    pass_id = 0
    for psm in ("11", "6"):
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        try:
            cv2.imwrite(tmp.name, ocr_img)
            out = subprocess.run(
                ["tesseract", tmp.name, "stdout", "--psm", psm, "tsv"],
                capture_output=True, text=True, timeout=30,
            ).stdout
        except Exception:
            out = ""
        finally:
            os.unlink(tmp.name)
        pass_id += 1
        for row in out.splitlines()[1:]:
            c = row.split("\t")
            if len(c) < 12:
                continue
            try:
                conf = float(c[10])
            except ValueError:
                continue
            text = c[11].strip()
            if conf < min_conf or len(text) < 2:
                continue
            if not any(ch.isalnum() for ch in text):
                continue
            left, top = int(c[6]) / scale, int(c[7]) / scale
            w, h = int(c[8]) / scale, int(c[9]) / scale
            left, top, w, h = int(left), int(top), int(w), int(h)
            # ignore text outside the building footprint (title block, legend…)
            if env is not None:
                wy = min(H - 1, max(0, top + h // 2))
                wx = min(W - 1, max(0, left + w // 2))
                if not env[wy, wx]:
                    continue
            key = (pass_id, c[2], c[3], c[4])
            lines.setdefault(key, []).append((text, left, top, w, h))

    walkable = walk.astype(bool)
    pois = []
    seen = set()
    for parts in lines.values():
        parts.sort(key=lambda p: p[1])
        label = " ".join(p[0] for p in parts).strip()
        # crude cleanup of common OCR noise
        label = label.replace("|", "I").strip(" .:-_")
        label = re.sub(r"\s{2,}", " ", label)
        if label.lower() in seen or not _good_label(label):
            continue
        # Drop merge artifacts: a multi-word label whose every word is already a
        # room on its own (e.g. PSM-6 reading "OFFICE LOBBY" as one line).
        words = [w for w in label.lower().split() if len(w) >= 3]
        if len(words) >= 2 and all(w in seen for w in words):
            continue
        x0 = min(p[1] for p in parts)
        y0 = min(p[2] for p in parts)
        x1 = max(p[1] + p[3] for p in parts)
        y1 = max(p[2] + p[4] for p in parts)
        cx = (x0 + x1) / 2 / W * cols
        cy = (y0 + y1) / 2 / H * rows
        gx, gy = int(cx), int(cy)
        # Snap to the nearest walkable cell. Labels are often printed near a
        # wall or over furniture, so search a generous radius (scaled to the
        # grid) — otherwise real room labels get dropped and never reach the
        # delivery dropdown.
        snap_radius = max(6, cols // 6, rows // 6)
        snap = _nearest_walkable(walkable, gx, gy, cols, rows, radius=snap_radius)
        if snap is None:
            continue
        seen.add(label.lower())
        pois.append({
            "id": f"ocr{len(pois)}",
            "type": "unit",
            "label": label[:40],
            "x": snap[0],
            "y": snap[1],
            "source": "ocr",
        })
        if len(pois) >= 40:
            break

    # Local building-model AI: classify each room from its label and set its
    # robot policy (deliverable / charging / restricted). Runs on-device, no
    # weights. Kept optional so the analyzer never hard-depends on it.
    try:
        from local_model import enrich_pois
        pois = enrich_pois(pois)
    except Exception:  # noqa: BLE001
        pass
    return pois


def _nearest_walkable(walkable, gx, gy, cols, rows, radius=4):
    gx = max(0, min(cols - 1, gx))
    gy = max(0, min(rows - 1, gy))
    if walkable[gy, gx]:
        return (gx, gy)
    for r in range(1, radius + 1):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                x, y = gx + dx, gy + dy
                if 0 <= x < cols and 0 <= y < rows and walkable[y, x]:
                    return (x, y)
    return None


def _interior_grid(interior, cols, rows):
    H, W = interior.shape
    grid = np.zeros((rows, cols), dtype=bool)
    ys = np.linspace(0, H, rows + 1).astype(int)
    xs = np.linspace(0, W, cols + 1).astype(int)
    for gy in range(rows):
        for gx in range(cols):
            y0, y1 = ys[gy], max(ys[gy] + 1, ys[gy + 1])
            x0, x1 = xs[gx], max(xs[gx] + 1, xs[gx + 1])
            grid[gy, gx] = interior[y0:y1, x0:x1].mean() >= 0.4
    return grid


def _region(cells, cols, question, kind, walkable_if_yes):
    idx = [int(y) * cols + int(x) for y, x in cells]
    cy = float(np.mean(cells[:, 0]))
    cx = float(np.mean(cells[:, 1]))
    return {
        "cells": idx,
        "centroid": {"x": round(cx, 1), "y": round(cy, 1)},
        "question": question,
        "kind": kind,
        "walkableIfYes": walkable_if_yes,
    }


def analyze_dl(path, **kw):
    """Placeholder for a deep segmentation upgrade (CubiCasa5K / DeepFloorplan).

    When pretrained weights are provisioned, run the segmentation model here
    to produce wall / door / room class maps, then reduce to the same JSON
    contract as analyze(). The server and UI need no changes.
    """
    raise NotImplementedError("deep model weights not provisioned")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--max-dim", type=int, default=72)
    ap.add_argument("--cell-size", type=float, default=0.5)
    args = ap.parse_args()
    try:
        result = analyze(args.image, max_dim=args.max_dim, cell_size=args.cell_size)
        sys.stdout.write(json.dumps(result))
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(str(exc))
        sys.exit(1)


if __name__ == "__main__":
    main()
