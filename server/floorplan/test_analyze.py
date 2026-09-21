"""Tests for the floor-plan analyzer: classical pipeline + optional ONNX DL
wall segmenter. Run: python3 -m pytest server/floorplan/test_analyze.py

The DL test builds a trivial 'dark->wall' ONNX model on the fly (no external
weights, which the sandbox can't download) purely to verify the integration:
that a configured ONNX model is loaded and used, and its output flows through
the same grid/room-segmentation contract.
"""
import os
import sys

import pytest

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
SAMPLE = os.path.join(HERE, 'sample_blueprint.png')

import analyze  # noqa: E402
import dl_segment  # noqa: E402


def _reset_dl():
    dl_segment._segmenter = None
    dl_segment._loaded = False


def test_classical_pipeline():
    _reset_dl()
    os.environ.pop('CLONIFY_DL_MODEL', None)
    r = analyze.analyze(SAMPLE, max_dim=40)
    assert r['method'].startswith('opencv-classical')   # may be fused with +localml
    assert 'local-ml-kmeans' in r['engines']            # ML runs alongside
    assert 'local-ai-rules' in r['engines']             # rule-based AI runs too
    assert r['cells'].count(1) > 0 and r['cells'].count(0) > 0
    assert len(r['uncertain']) == 0            # never asks the operator
    assert len(r['cells']) == r['cols'] * r['rows']


def test_walkable_stays_inside_building_envelope(tmp_path):
    """A full drawing sheet (border frame + title block + building) must not
    leak walkable area outside the building's exterior walls."""
    import cv2
    import numpy as np
    _reset_dl()
    os.environ.pop('CLONIFY_DL_MODEL', None)
    H, W = 900, 1200
    img = np.full((H, W), 255, np.uint8)
    cv2.rectangle(img, (20, 20), (W - 20, H - 20), 0, 3)          # sheet frame
    cv2.rectangle(img, (W - 260, H - 160), (W - 40, H - 40), 0, 2)  # title block
    cv2.putText(img, 'CASA LOMA', (W - 240, H - 110), cv2.FONT_HERSHEY_SIMPLEX, 0.7, 0, 2)
    bx0, by0, bx1, by1 = 250, 250, 750, 650
    cv2.rectangle(img, (bx0, by0), (bx1, by1), 0, 6)             # building walls
    cv2.line(img, (500, by0), (500, by1), 0, 4)                  # partition
    cv2.putText(img, 'OFFICE', (320, 450), cv2.FONT_HERSHEY_SIMPLEX, 0.8, 0, 2)
    cv2.putText(img, 'LOBBY', (560, 450), cv2.FONT_HERSHEY_SIMPLEX, 0.8, 0, 2)
    p = str(tmp_path / 'plan.png')
    cv2.imwrite(p, img)

    r = analyze.analyze(p, max_dim=72)
    cols, rows, cells = r['cols'], r['rows'], r['cells']
    gx0, gx1 = int(bx0 / W * cols), int(bx1 / W * cols)
    gy0, gy1 = int(by0 / H * rows), int(by1 / H * rows)
    inside = outside = 0
    for gy in range(rows):
        for gx in range(cols):
            if cells[gy * cols + gx] == 1:
                if gx0 - 1 <= gx <= gx1 + 1 and gy0 - 1 <= gy <= gy1 + 1:
                    inside += 1
                else:
                    outside += 1
    assert inside > 0
    assert outside <= 3                       # essentially nothing outside the walls
    # title-block text must not become a delivery point
    assert all('CASA' not in p['label'].upper() for p in r['pois'])


def test_ignores_separate_detail_drawings(tmp_path):
    """A measured-drawings sheet often has the floor plan plus separate tower /
    section detail drawings elsewhere on the page. The walkable area must cover
    only the main building, not spill across to the detail drawings."""
    import cv2
    import numpy as np
    _reset_dl()
    os.environ.pop('CLONIFY_DL_MODEL', None)
    H, W = 1000, 1600
    img = np.full((H, W), 255, np.uint8)
    cv2.rectangle(img, (20, 20), (W - 20, H - 20), 0, 3)        # sheet frame
    mx0, my0, mx1, my1 = 200, 200, 900, 800
    cv2.rectangle(img, (mx0, my0), (mx1, my1), 0, 7)           # main building
    cv2.line(img, (550, my0), (550, my1), 0, 4)
    cv2.line(img, (550, 460), (550, 520), 255, 7)             # door
    # separate circular tower detail drawings on the right of the sheet
    for cy in (250, 500, 750):
        cv2.circle(img, (1350, cy), 90, 0, 3)
    p = str(tmp_path / 'sheet.png')
    cv2.imwrite(p, img)

    r = analyze.analyze(p, max_dim=120)
    cols, rows, cells = r['cols'], r['rows'], r['cells']
    gx0, gx1 = int(mx0 / W * cols), int(mx1 / W * cols)
    gy0, gy1 = int(my0 / H * rows), int(my1 / H * rows)
    detail_side = int(1000 / W * cols)
    outside = on_detail = 0
    for gy in range(rows):
        for gx in range(cols):
            if cells[gy * cols + gx] != 1:
                continue
            if not (gx0 - 2 <= gx <= gx1 + 2 and gy0 - 2 <= gy <= gy1 + 2):
                outside += 1
                if gx > detail_side:
                    on_detail += 1
    assert on_detail == 0        # nothing on the tower-detail drawings
    assert outside <= 5          # essentially nothing outside the building


def test_detects_door_swing_arcs_not_towers(tmp_path):
    """Quarter-circle door swing symbols are detected; a big round tower wall
    (large radius) is not mistaken for a door."""
    import cv2
    import numpy as np
    _reset_dl()
    os.environ.pop('CLONIFY_DL_MODEL', None)
    H, W = 1000, 1400
    img = np.full((H, W), 255, np.uint8)
    cv2.rectangle(img, (20, 20), (W - 20, H - 20), 0, 3)
    cv2.rectangle(img, (200, 200), (900, 800), 0, 7)
    R = 26
    cv2.line(img, (550, 200), (550, 540 - R), 0, 5)
    cv2.line(img, (550, 540), (550, 800), 0, 5)
    cv2.line(img, (550, 540), (550 + R, 540), 0, 3)          # door leaf
    cv2.ellipse(img, (550, 540), (R, R), 0, 0, -90, 0, 2)   # swing arc
    cv2.circle(img, (1150, 300), 120, 0, 7)                 # round tower (not a door)
    p = str(tmp_path / 'door.png')
    cv2.imwrite(p, img)

    r = analyze.analyze(p, max_dim=120)
    assert len(r['doors']) >= 1
    for d in r['doors']:
        assert 0.3 < d['radiusM'] < 2.0          # a real door leaf, not a tower
    assert 'door-arc-detect' in r['engines']


def test_dl_backend_integration(tmp_path, monkeypatch):
    onnx = pytest.importorskip('onnx')
    pytest.importorskip('onnxruntime')
    from onnx import helper, TensorProto

    S = 256
    half = helper.make_tensor('half', TensorProto.FLOAT, [1, 1, 1, 1], [0.5])
    nodes = [
        helper.make_node('Sub', ['half', 'X'], ['wall_logit']),  # 0.5 - x (dark → wall)
        helper.make_node('Sub', ['X', 'half'], ['bg_logit']),
        helper.make_node('Concat', ['bg_logit', 'wall_logit'], ['logits'], axis=1),
    ]
    graph = helper.make_graph(
        nodes, 'seg',
        [helper.make_tensor_value_info('X', TensorProto.FLOAT, [1, 1, S, S])],
        [helper.make_tensor_value_info('logits', TensorProto.FLOAT, [1, 2, S, S])],
        [half],
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid('', 13)])
    onnx.checker.check_model(model)
    model_path = str(tmp_path / 'toy_seg.onnx')
    onnx.save(model, model_path)

    _reset_dl()
    monkeypatch.setenv('CLONIFY_DL_MODEL', model_path)
    monkeypatch.setenv('CLONIFY_DL_INPUT', str(S))
    monkeypatch.setenv('CLONIFY_DL_WALL_CHANNEL', '1')

    r = analyze.analyze(SAMPLE, max_dim=40)
    assert r['method'].startswith('onnx-dl')   # the ONNX model was used (may fuse +localml)
    assert r['cells'].count(1) > 0 and r['cells'].count(0) > 0
    assert len(r['cells']) == r['cols'] * r['rows']
    _reset_dl()
