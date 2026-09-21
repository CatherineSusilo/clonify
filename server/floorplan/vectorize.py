"""
Vectorize the raster floor plan into clean 2D polygons with Shapely.

The grid model is great for navigation, but a voxel grid makes a blocky 3D
model. Vectorization recovers the building's *actual shape*: the exterior
footprint and each room as a simplified polygon, with real areas and
centroids. Shapely does the polygon maths (simplification, validity, area,
representative interior point); OpenCV extracts the raw contours.

This is optional — if Shapely is not installed the analyzer skips it and
everything else still works. When present, the analyzer emits:

  footprint : [[x,y], ...]            exterior outline, metres, simplified
  rooms     : [{ polygon:[[x,y]...], areaM2, centroid:[x,y] }, ...]

Coordinates are in metres (grid cell = cellSize m), matching the CBM.
"""
import numpy as np

try:
    import cv2
    from shapely.geometry import Polygon, MultiPolygon
    from shapely.ops import unary_union
    from shapely import make_valid
    _HAVE = True
except Exception:  # pragma: no cover
    _HAVE = False


def available():
    return _HAVE


def _poly_from_contour(cnt, sx, sy):
    pts = [(float(p[0][0]) * sx, float(p[0][1]) * sy) for p in cnt]
    if len(pts) < 3:
        return None
    poly = Polygon(pts)
    if not poly.is_valid:
        poly = make_valid(poly)
    if poly.is_empty:
        return None
    return poly


def _largest_polygon(geom):
    if geom is None or geom.is_empty:
        return None
    if geom.geom_type == 'Polygon':
        return geom
    if geom.geom_type in ('MultiPolygon', 'GeometryCollection'):
        polys = [g for g in geom.geoms if g.geom_type == 'Polygon']
        return max(polys, key=lambda p: p.area) if polys else None
    return None


def vectorize(env, walls, cols, rows, cell_size, min_room_cells=6):
    """Return (footprint, rooms) in metres, or (None, []) if unavailable.

    env    : bool building-footprint mask (pixels)
    walls  : bool wall mask (pixels)
    """
    if not _HAVE or env is None or not env.any():
        return None, []
    H, W = env.shape
    # metres-per-pixel so contour pixel coords map straight to CBM metres
    sx = (cols * cell_size) / W
    sy = (rows * cell_size) / H

    # --- exterior footprint: largest external contour of the building mask ---
    env_u8 = (env.astype(np.uint8)) * 255
    cnts, _ = cv2.findContours(env_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    footprint = None
    if cnts:
        big = max(cnts, key=cv2.contourArea)
        poly = _poly_from_contour(big, sx, sy)
        poly = _largest_polygon(poly)
        if poly is not None:
            # simplify to straighten jagged raster edges (~one cell tolerance)
            poly = poly.simplify(cell_size * 0.9, preserve_topology=True)
            poly = _largest_polygon(poly) or poly
            footprint = [[round(x, 3), round(y, 3)] for x, y in poly.exterior.coords]

    # --- rooms: interior split by walls → connected open regions -------------
    inner = (env > 0) & (~walls)
    inner_u8 = (inner.astype(np.uint8)) * 255
    # open to drop hairline bridges through doorways so rooms separate cleanly
    inner_u8 = cv2.morphologyEx(inner_u8, cv2.MORPH_OPEN,
                                cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    n, lbl = cv2.connectedComponents(inner_u8)
    rooms = []
    px_per_cell = (W / cols) * (H / rows)
    for c in range(1, n):
        mask = (lbl == c).astype(np.uint8) * 255
        if int(mask.sum() / 255) < min_room_cells * px_per_cell:
            continue
        rc, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not rc:
            continue
        poly = _poly_from_contour(max(rc, key=cv2.contourArea), sx, sy)
        poly = _largest_polygon(poly)
        if poly is None or poly.area < (cell_size ** 2) * min_room_cells:
            continue
        poly = poly.simplify(cell_size * 0.75, preserve_topology=True)
        poly = _largest_polygon(poly) or poly
        rep = poly.representative_point()  # a point guaranteed inside the room
        rooms.append({
            "polygon": [[round(x, 3), round(y, 3)] for x, y in poly.exterior.coords],
            "areaM2": round(poly.area, 2),
            "centroid": [round(rep.x, 3), round(rep.y, 3)],
        })
    rooms.sort(key=lambda r: -r["areaM2"])
    return footprint, rooms


def anchor_pois(pois, rooms, cell_size, walk):
    """Move each OCR delivery point to the centre of the room that contains its
    label, and tag it with the room area. A label is often printed off to one
    side of a room; centring the delivery point makes the robot stop in the
    middle of the room. Falls back to the label position if it isn't inside any
    room or the centre isn't walkable."""
    if not _HAVE or not rooms:
        return pois
    rows, cols = walk.shape
    polys = [(Polygon(r["polygon"]), r) for r in rooms if len(r["polygon"]) >= 4]
    for p in pois:
        from shapely.geometry import Point
        wx = (p["x"] + 0.5) * cell_size
        wy = (p["y"] + 0.5) * cell_size
        pt = Point(wx, wy)
        for poly, r in polys:
            if poly.contains(pt):
                gx = int(r["centroid"][0] / cell_size)
                gy = int(r["centroid"][1] / cell_size)
                if 0 <= gx < cols and 0 <= gy < rows and walk[gy, gx] == 1:
                    p["x"], p["y"] = gx, gy
                p["roomAreaM2"] = r["areaM2"]
                break
    return pois
