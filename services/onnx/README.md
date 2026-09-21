# ONNX computer-vision pipeline

The three Clonify phases share the same spatial evidence, but model training is
opt-in and isolated from normal reconstruction. Train or fine-tune a vision
model in its source framework only with consented, de-identified data; export
the approved checkpoint to ONNX; validate it against a held-out set; and run
the resulting artifact with ONNX Runtime in the navigation/robotics worker.

The application currently stores the consent decision on `User`; a production
trainer must enforce that flag before dataset export and record dataset/model
lineage. ONNX Runtime is intentionally not added to the web bundle: it belongs
in the local inference worker so browser users do not download model weights.
