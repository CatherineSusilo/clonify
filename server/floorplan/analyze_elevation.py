#!/usr/bin/env python3
"""
Elevation (side-view) blueprint analyzer.

The floor plans give the building's footprint; the *elevation* drawings give
its real shape in the vertical dimension — how many storeys and how tall each
one is. Using them means the compiled 3D model has the building's actual
storey heights instead of a generic 3 m per floor.

Method (OpenCV, weights-free): the strongest evidence of a storey in an
elevation drawing is the set of long horizontal lines — floor slabs, string
courses, window head/sill bands. We detect horizontal structure with a
morphological horizontal-line filter, collapse it to a 1-D row profile, find
the dominant horizontal bands (the floor/ceiling lines), and read off the
spacing between consecutive bands as relative storey heights. Ratios are
returned so the caller can scale them to metres against a known total height
or a per-floor default.

Usage:
  python3 analyze_elevation.py --image north.png [--image south.png ...] --floors N
Emits JSON: { floors, heightRatios:[...], totalToGroundRatio, method, bands }
"""
import argparse
import json
import sys

import cv2
import numpy as np


def _horizontal_band_rows(gray):
    """Return the y-rows (0..H) that carry strong horizontal structure."""
    H, W = gray.shape
    _, ink = cv2.threshold(cv2.GaussianBlur(gray, (3, 3), 0), 0, 255,
                           cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    # keep only long horizontal runs (floor slabs / bands), drop vertical edges
    L = max(20, int(W * 0.35))
    hor = cv2.morphologyEx(ink, cv2.MORPH_OPEN,
                           cv2.getStructuringElement(cv2.MORPH_RECT, (L, 1)))
    profile = hor.sum(axis=1).astype(np.float64)  # per-row horizontal-ink mass
    if profile.max() <= 0:
        return [], profile
    profile /= profile.max()
    # peak rows: local maxima above a threshold, de-duplicated by proximity
    thresh = 0.35
    peaks = []
    min_gap = max(4, int(H * 0.04))
    y = 0
    while y < H:
        if profile[y] >= thresh:
            # take the centroid of this contiguous band
            y0 = y
            while y < H and profile[y] >= thresh:
                y += 1
            peaks.append((y0 + y - 1) // 2)
        else:
            y += 1
    # merge peaks closer than min_gap
    merged = []
    for p in peaks:
        if merged and p - merged[-1] < min_gap:
            merged[-1] = (merged[-1] + p) // 2
        else:
            merged.append(p)
    return merged, profile


def analyze_elevation(paths, floors=None):
    best = None
    for path in paths:
        gray = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        if gray is None:
            continue
        H, W = gray.shape
        scale = min(1.0, 1600 / max(H, W))
        if scale < 1.0:
            gray = cv2.resize(gray, (int(W * scale), int(H * scale)), interpolation=cv2.INTER_AREA)
        bands, _ = _horizontal_band_rows(gray)
        # score: an elevation with more clear storey bands is the better source
        if best is None or len(bands) > len(best[1]):
            best = (gray, bands)
    if best is None:
        return {"floors": floors or 1, "heightRatios": None, "method": "no-image"}

    gray, bands = best
    H = gray.shape[0]
    bands = sorted(bands)
    # gaps between consecutive horizontal bands ≈ storey heights (top→bottom)
    gaps = [bands[i + 1] - bands[i] for i in range(len(bands) - 1)]
    gaps = [g for g in gaps if g > H * 0.03]  # ignore window bands within a storey

    if floors and len(gaps) >= floors:
        # keep the `floors` largest gaps (the storey slabs), ordered top→bottom
        idx = sorted(sorted(range(len(gaps)), key=lambda i: -gaps[i])[:floors])
        gaps = [gaps[i] for i in idx]
    if not gaps:
        return {"floors": floors or 1, "heightRatios": None, "bands": len(bands), "method": "opencv-elevation"}

    total = float(sum(gaps))
    ratios = [round(g / total, 4) for g in gaps]
    # elevation is drawn top storey first; buildings number floors bottom→up
    ratios = list(reversed(ratios))
    return {
        "floors": len(ratios),
        "heightRatios": ratios,
        "bands": len(bands),
        "method": "opencv-elevation",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", action="append", required=True)
    ap.add_argument("--floors", type=int, default=None)
    args = ap.parse_args()
    try:
        sys.stdout.write(json.dumps(analyze_elevation(args.image, args.floors)))
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(str(exc))
        sys.exit(1)


if __name__ == "__main__":
    main()
