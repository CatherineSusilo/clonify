"""Optional deep-learning wall segmenter for the floor-plan analyzer.

This is the upgrade path from the classical OpenCV wall detection to a
learned segmentation model, for higher recall on rough scans and unusual
drafting styles — the direction that closes the gap toward commercial tools.

Rather than hard-wire one research model, this loads any **ONNX** floor-plan
segmentation network and uses its wall / room-boundary output as the wall
mask; everything downstream (interior detection, automatic room
segmentation, OCR delivery points) is unchanged. ONNX was chosen over a
framework-specific model because it is light (onnxruntime, CPU, ~50 MB vs
PyTorch ~500 MB), needs no model source code, and any model exports to it —
including **CubiCasa5K** and **Deep Floor Plan Recognition**, which are the
reference nets in the literature. See floorplan/DL_MODEL.md for how to
export CubiCasa5K to ONNX and enable it.

Activation (all optional — absent → the classical pipeline is used):
    CLONIFY_DL_MODEL        path to the .onnx segmentation model
    CLONIFY_DL_INPUT        square input size the model expects (default 512)
    CLONIFY_DL_WALL_CHANNEL output channel(s) that mean "wall/boundary"
                            (int, or comma-separated list to sum; default 1)
    CLONIFY_DL_LOGITS       "1" if the model emits logits (apply softmax),
                            "0" if it already emits probabilities (default 1)
"""
from __future__ import annotations

import os

import cv2
import numpy as np

_segmenter = None
_loaded = False


class OnnxWallSegmenter:
    def __init__(self, model_path, input_size=512, wall_channels=(1,), logits=True):
        import onnxruntime as ort  # imported lazily so the dep is optional
        self.session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
        self.input_name = self.session.get_inputs()[0].name
        self.input_size = int(input_size)
        self.wall_channels = list(wall_channels)
        self.logits = logits

    def wall_probability(self, gray):
        """Return an HxW float map in [0,1]: probability each pixel is a wall."""
        H, W = gray.shape
        inp = cv2.resize(gray, (self.input_size, self.input_size), interpolation=cv2.INTER_AREA)
        x = inp.astype(np.float32) / 255.0
        x = x[None, None, :, :]  # NCHW, single channel
        out = self.session.run(None, {self.input_name: x})[0]
        out = np.asarray(out)
        if out.ndim == 4:
            out = out[0]                    # C,h,w
        elif out.ndim == 3:
            pass                            # already C,h,w
        else:
            raise ValueError(f'unexpected model output shape {out.shape}')
        if self.logits:
            e = np.exp(out - out.max(axis=0, keepdims=True))
            probs = e / e.sum(axis=0, keepdims=True)
        else:
            probs = out
        wall = np.clip(sum(probs[c] for c in self.wall_channels), 0.0, 1.0)
        return cv2.resize(wall.astype(np.float32), (W, H), interpolation=cv2.INTER_LINEAR)

    def wall_mask(self, gray, thresh=0.5):
        """Boolean wall mask, cleaned so thin gaps close (barrier geometry)."""
        prob = self.wall_probability(gray)
        walls = (prob >= thresh).astype(np.uint8) * 255
        walls = cv2.morphologyEx(walls, cv2.MORPH_CLOSE,
                                 cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
        return walls > 0


def get_dl_segmenter():
    """Return a cached segmenter if CLONIFY_DL_MODEL is set and loadable, else
    None (caller falls back to the classical wall detector)."""
    global _segmenter, _loaded
    if _loaded:
        return _segmenter
    _loaded = True
    path = os.environ.get('CLONIFY_DL_MODEL')
    if not path or not os.path.exists(path):
        return None
    try:
        chans = os.environ.get('CLONIFY_DL_WALL_CHANNEL', '1')
        wall_channels = tuple(int(c) for c in chans.split(',') if c.strip() != '')
        _segmenter = OnnxWallSegmenter(
            path,
            input_size=int(os.environ.get('CLONIFY_DL_INPUT', '512')),
            wall_channels=wall_channels or (1,),
            logits=os.environ.get('CLONIFY_DL_LOGITS', '1') != '0',
        )
        return _segmenter
    except Exception as exc:  # noqa: BLE001
        import sys
        sys.stderr.write(f'[dl_segment] failed to load {path}: {exc}\n')
        _segmenter = None
        return None
