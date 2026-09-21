"""Local, weights-free ML wall segmenter (unsupervised).

This is the *machine-learning* half of Clonify's "both AI and ML" perception
stack, and unlike the optional ONNX deep model (`dl_segment.py`) it needs no
downloaded weights and no network — it **learns from each blueprint itself**.

For every ink (dark) pixel it builds a small feature vector and runs
**k-means clustering** (implemented in NumPy, no scikit-learn dependency) to
separate the two populations that a floor plan always contains:

  * thin ink belonging to small components — text, dimension marks, hatching,
    furniture symbols; and
  * thick ink belonging to large connected structures — the walls.

Because the threshold is *learned per image* (data-driven) rather than a
fixed constant, it adapts to line weight, scan resolution and drafting style
— which is exactly where a hard-coded classical threshold struggles on
ornate or rough plans. Its wall mask is then fused with the classical /
ONNX perception so the two models complement each other (union → higher wall
recall, which only ever shrinks the walkable area, never leaks it outside).

Enabled by default; set CLONIFY_LOCAL_ML=0 to turn the ML fusion off.
"""
import os

import numpy as np

try:
    import cv2
    from scipy import ndimage
except Exception:  # pragma: no cover - deps guaranteed in the analyzer image
    cv2 = None
    ndimage = None


def _kmeans(X, k=2, iters=15, seed=0):
    """Minimal k-means (Lloyd's algorithm) in NumPy. Returns (labels, centers).

    Fits on a random subsample for speed, then the caller assigns all points
    to the nearest learned center. This is a real, if small, ML model — the
    cluster centers are parameters learned from the data."""
    rng = np.random.default_rng(seed)
    n = len(X)
    fit = X if n <= 40000 else X[rng.choice(n, 40000, replace=False)]
    centers = fit[rng.choice(len(fit), k, replace=False)].astype(np.float64)
    for _ in range(iters):
        d = ((fit[:, None, :] - centers[None, :, :]) ** 2).sum(2)
        lab = d.argmin(1)
        new = np.stack([fit[lab == j].mean(0) if np.any(lab == j) else centers[j]
                        for j in range(k)])
        if np.allclose(new, centers):
            centers = new
            break
        centers = new
    return centers


def _assign(X, centers):
    d = ((X[:, None, :] - centers[None, :, :]) ** 2).sum(2)
    return d.argmin(1)


class LocalMLSegmenter:
    """Unsupervised, per-image ML wall segmenter (k-means over pixel features)."""

    name = "local-ml-kmeans"

    def wall_mask(self, gray):
        if cv2 is None:
            raise RuntimeError("cv2/scipy unavailable")
        H, W = gray.shape
        blur = cv2.GaussianBlur(gray, (3, 3), 0)
        _, ink_img = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        ink = ink_img > 0
        if ink.sum() < 50:
            return np.zeros((H, W), bool)

        # feature 1: stroke thickness (distance transform of the ink)
        dist = cv2.distanceTransform(ink_img, cv2.DIST_L2, 3)
        # feature 2: size of the connected ink component each pixel belongs to
        lbl, n = ndimage.label(ink)
        sizes = np.bincount(lbl.ravel())
        comp = sizes[lbl].astype(np.float32)
        comp_log = np.log1p(comp)

        ys, xs = np.where(ink)
        feats = np.stack([dist[ys, xs], comp_log[ys, xs]], axis=1).astype(np.float64)
        # standardise so both features weigh in
        mu, sd = feats.mean(0), feats.std(0) + 1e-6
        Z = (feats - mu) / sd

        centers = _kmeans(Z, k=2, seed=0)
        labels = _assign(Z, centers)
        # the wall cluster is the one with the larger thickness+size centroid
        wall_cluster = int(np.argmax(centers.sum(1)))

        mask = np.zeros((H, W), bool)
        wall_px = labels == wall_cluster
        mask[ys[wall_px], xs[wall_px]] = True
        # tidy: keep it a barrier, close 1px gaps
        mask_u8 = (mask.astype(np.uint8)) * 255
        mask_u8 = cv2.morphologyEx(mask_u8, cv2.MORPH_CLOSE,
                                   cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
        return mask_u8 > 0


_seg = None
_loaded = False


def get_local_ml_segmenter():
    """Return the local ML segmenter, or None if disabled via CLONIFY_LOCAL_ML=0."""
    global _seg, _loaded
    if _loaded:
        return _seg
    _loaded = True
    if os.environ.get("CLONIFY_LOCAL_ML", "1") not in ("1", "true", "True", "yes"):
        _seg = None
    else:
        _seg = LocalMLSegmenter()
    return _seg
