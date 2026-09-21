# Deep-learning wall segmenter (optional upgrade)

The default blueprint→grid analyzer (`analyze.py`) uses a classical OpenCV
pipeline that works well on clean vector blueprints. For **higher recall on
rough scans, photocopies, and unusual drafting styles** — the direction that
narrows the gap to commercial tools — you can plug in a learned segmentation
model. Nothing downstream changes: the model only replaces wall detection,
and interior/room segmentation, connectivity and OCR delivery-point naming
all run exactly as before.

## How it works

`dl_segment.py` loads any **ONNX** floor-plan segmentation network and uses
its wall / room-boundary output as the wall mask. ONNX keeps the runtime
light (onnxruntime, CPU, no training framework) and model-agnostic. When a
model is configured the analyzer reports `"method": "onnx-dl"`; otherwise
`"opencv-classical"`.

## Enable it

1. Install the optional runtime:
   ```bash
   pip install -r server/floorplan/requirements-dl.txt
   ```
2. Put an `.onnx` segmentation model on disk and point the server at it:
   ```bash
   export CLONIFY_DL_MODEL=/models/floorplan_seg.onnx
   export CLONIFY_DL_INPUT=512          # square input size the model expects
   export CLONIFY_DL_WALL_CHANNEL=1     # output channel(s) meaning "wall"
                                        #   (comma-separated to sum several)
   export CLONIFY_DL_LOGITS=1           # 1 = model emits logits (softmax applied)
   ```
   Restart the server. That's it — uploads now use the learned segmenter.

## Recommended models (export to ONNX)

These are the reference nets from the research; both are open source and
export to ONNX with `torch.onnx.export`:

- **CubiCasa5K** — Kalervo et al., 2019 (github.com/CubiCasa/CubiCasa5k).
  Multi-task net; its room-boundary/wall channels become `CLONIFY_DL_WALL_CHANNEL`.
- **Deep Floor Plan Recognition** — Zeng et al., ICCV 2019
  (github.com/zlzeng/DeepFloorplan). Room-boundary head = the wall channel.

Export sketch (run where the model + weights are available):

```python
import torch
model = load_pretrained()          # the repo's model + weights
model.eval()
dummy = torch.zeros(1, 3, 512, 512) # or 1,1,512,512 for a greyscale model
torch.onnx.export(model, dummy, "floorplan_seg.onnx",
                  input_names=["X"], output_names=["logits"], opset_version=13)
```

Then set `CLONIFY_DL_WALL_CHANNEL` to the index(es) of the wall/boundary
class in that model's output and enable as above.

> Note: the sandbox this was built in cannot reach the model-weight hosts
> (Zenodo/HuggingFace are blocked), so the shipped tests verify the ONNX
> integration with a tiny generated model rather than a full pretrained net.
> Drop in real weights per the steps above to get production quality.
