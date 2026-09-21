"""Test the elevation blueprint analyzer (storey-height detection)."""
import os
import sys

import numpy as np

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)

import analyze_elevation  # noqa: E402


def test_detects_storey_bands(tmp_path):
    import cv2
    H, W = 600, 400
    img = np.full((H, W), 255, np.uint8)
    # four horizontal floor lines → three storeys; gaps 140/180/180 px
    for y in (60, 200, 380, 560):
        cv2.line(img, (30, y), (W - 30, y), 0, 4)
    cv2.line(img, (30, 60), (30, 560), 0, 3)
    cv2.line(img, (W - 30, 60), (W - 30, 560), 0, 3)
    p = str(tmp_path / 'north.png')
    cv2.imwrite(p, img)

    r = analyze_elevation.analyze_elevation([p], floors=3)
    assert r['method'] == 'opencv-elevation'
    assert r['floors'] == 3
    assert r['heightRatios'] is not None
    assert abs(sum(r['heightRatios']) - 1.0) < 1e-6
    # the two taller storeys should each exceed the shorter one
    assert max(r['heightRatios']) > min(r['heightRatios'])
