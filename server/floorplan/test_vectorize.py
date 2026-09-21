"""Test Shapely vectorization: footprint polygon + room polygons + POI anchor."""
import os
import sys

import numpy as np
import pytest

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)

import vectorize  # noqa: E402


def test_footprint_and_rooms():
    if not vectorize.available():
        pytest.skip("shapely not installed")
    H, W = 400, 400
    env = np.zeros((H, W), bool)
    env[50:350, 50:350] = True          # solid building footprint
    walls = np.zeros((H, W), bool)
    walls[50:350, 198:202] = True        # one interior partition (no door)
    footprint, rooms = vectorize.vectorize(env, walls, cols=80, rows=80, cell_size=0.5)
    assert footprint is not None and len(footprint) >= 4
    # a partition with no door → two rooms
    assert len(rooms) >= 2
    for r in rooms:
        assert r["areaM2"] > 0
        assert len(r["centroid"]) == 2


def test_anchor_pois_to_room_center():
    if not vectorize.available():
        pytest.skip("shapely not installed")
    H, W = 400, 400
    env = np.zeros((H, W), bool); env[50:350, 50:350] = True
    walls = np.zeros((H, W), bool)
    cols = rows = 80
    walk = np.ones((rows, cols), np.uint8)
    _, rooms = vectorize.vectorize(env, walls, cols, rows, 0.5)
    # a POI stuck in a corner should be pulled toward the room centre
    pois = [{"x": 12, "y": 12, "label": "OFFICE"}]
    out = vectorize.anchor_pois(pois, rooms, 0.5, walk)
    assert "roomAreaM2" in out[0]
