"""Local MapAnything inference bridge for Clonify.

Install MapAnything from the facebookresearch/map-anything checkout, then run:
  uvicorn app:app --host 127.0.0.1 --port 8787
"""

from pathlib import Path
import os
from tempfile import TemporaryDirectory
from typing import Annotated

import numpy as np
import torch
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from mapanything.models import MapAnything
from mapanything.utils.image import load_images

app = FastAPI(title="Clonify MapAnything bridge")
device = "cuda" if torch.cuda.is_available() else "cpu"
model = None

# Keep local CPU inference from consuming every core. CUDA users can override
# these before starting uvicorn.
if device == "cpu":
    torch.set_num_threads(int(os.environ.get("MAP_ANYTHING_CPU_THREADS", "2")))


def get_model():
    global model
    if model is None:
        model = MapAnything.from_pretrained("facebook/map-anything-apache").to(device)
        model.eval()
    return model


@app.get("/health")
async def health():
    # Readiness does not load the model; the first reconstruction loads it lazily.
    return JSONResponse({"status": "ok", "provider": "map-anything"})


@app.post("/infer")
async def infer(images: Annotated[list[UploadFile], File()]):
    with TemporaryDirectory() as directory:
        paths = []
        max_views = max(1, min(8, int(os.environ.get("MAP_ANYTHING_MAX_VIEWS", "4"))))
        for index, upload in enumerate(images[:max_views]):
            path = Path(directory) / f"{index}-{upload.filename or 'view.jpg'}"
            path.write_bytes(await upload.read())
            paths.append(str(path))

        views = load_images(paths)
        with torch.inference_mode():
            predictions = get_model().infer(
                views,
                memory_efficient_inference=True,
                minibatch_size=1,
                use_amp=device == "cuda",
                amp_dtype="fp16",
                apply_mask=True,
                mask_edges=True,
                apply_confidence_mask=True,
                confidence_percentile=20,
            )

        points = []
        confidences = []
        camera_poses = []
        scales = []
        for prediction in predictions:
            mask = prediction["mask"].detach().cpu().numpy().astype(bool).reshape(-1)
            xyz = prediction["pts3d"].detach().cpu().numpy().reshape(-1, 3)
            valid = xyz[mask]
            if len(valid):
                points.append(valid)
            confidence = prediction.get("conf")
            if confidence is not None:
                confidences.append(float(confidence.detach().float().mean().cpu()))
            poses = prediction.get("camera_poses")
            if poses is not None:
                camera_poses.extend(poses.detach().cpu().numpy().reshape(-1, 4, 4).tolist())
            scale = prediction.get("metric_scaling_factor")
            if scale is not None:
                scales.append(float(scale.detach().float().mean().cpu()))

        merged = np.concatenate(points) if points else np.empty((0, 3))
        if len(merged) > 12000:
            sample = np.linspace(0, len(merged) - 1, 12000, dtype=np.int64)
            merged = merged[sample]
        bounds = None
        if len(merged):
            bounds = {"min": merged.min(axis=0).tolist(), "max": merged.max(axis=0).tolist()}

        return {
            "provider": "map-anything",
            "model": "facebook/map-anything-apache",
            "viewCount": len(predictions),
            "metricScale": float(np.mean(scales)) if scales else None,
            "meanConfidence": float(np.mean(confidences)) if confidences else None,
            "bounds": bounds,
            "cameraPoses": camera_poses or None,
            "pointCount": int(len(merged)),
            "points": merged.astype(np.float32).tolist(),
        }
