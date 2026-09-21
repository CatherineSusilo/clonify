"""Tests for the local, weights-free ML wall segmenter (k-means)."""
import os
import sys

import numpy as np

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)

import ml_segment  # noqa: E402


def _plan():
    import cv2
    H, W = 400, 500
    img = np.full((H, W), 255, np.uint8)
    cv2.rectangle(img, (60, 60), (440, 340), 0, 6)     # thick walls
    cv2.line(img, (250, 60), (250, 340), 0, 4)
    cv2.putText(img, 'ROOM ONE', (90, 210), cv2.FONT_HERSHEY_SIMPLEX, 0.6, 0, 1)  # thin text
    cv2.putText(img, 'ROOM TWO', (300, 210), cv2.FONT_HERSHEY_SIMPLEX, 0.6, 0, 1)
    return img


def test_learns_walls_over_text():
    ml_segment._seg = None
    ml_segment._loaded = False
    seg = ml_segment.get_local_ml_segmenter()
    assert seg is not None
    mask = seg.wall_mask(_plan())
    # walls occupy the frame + partition; a non-trivial number of pixels
    assert mask.sum() > 500
    # the thick rectangle border should be classified as wall
    assert mask[60, 250] or mask[63, 250]


def test_disabled_via_env(monkeypatch):
    monkeypatch.setenv('CLONIFY_LOCAL_ML', '0')
    ml_segment._seg = None
    ml_segment._loaded = False
    assert ml_segment.get_local_ml_segmenter() is None
    ml_segment._seg = None
    ml_segment._loaded = False
