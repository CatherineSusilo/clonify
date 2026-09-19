"use client";

import { useRef, useState } from "react";

type Props = {
  scanId: string;
  roomId: string;
  roomName: string;
  onClose: () => void;
  onUploaded: () => void;
};

export function RoomCaptureModal({ scanId, roomId, roomName, onClose, onUploaded }: Props) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [panorama, setPanorama] = useState<File | null>(null);
  const [panoramaWarning, setPanoramaWarning] = useState<string | null>(null);
  const [capturingScreen, setCapturingScreen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function startScreenCapture() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      streamRef.current = stream;
      setCapturingScreen(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError("Screen capture was cancelled or isn't available in this browser.");
    }
  }

  function grabScreenshot() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        setPhotos((prev) => [...prev, new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" })]);
      }
      stopScreenCapture();
    }, "image/png");
  }

  function stopScreenCapture() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCapturingScreen(false);
  }

  function handlePanoramaChange(file: File | null) {
    setPanorama(file);
    setPanoramaWarning(null);
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      if (Math.abs(ratio - 2) > 0.15) {
        setPanoramaWarning(
          "This doesn't look like a 2:1 equirectangular panorama — it'll still upload, but the 360° viewer may look stretched."
        );
      }
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  async function handleSubmit() {
    if (photos.length === 0 && !panorama) {
      setError("Add at least one photo or a panorama before saving.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    photos.forEach((p) => form.append("photos", p));
    if (panorama) form.set("panorama", panorama);

    try {
      const res = await fetch(`/api/scans/${scanId}/rooms/${roomId}/photos`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed. Try again.");
      onUploaded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg border border-line bg-ink p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium">Scan: {roomName}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink-text">
            Close
          </button>
        </div>

        {capturingScreen ? (
          <div className="mt-4">
            <video ref={videoRef} muted className="w-full border border-line" />
            <button
              type="button"
              onClick={grabScreenshot}
              className="mt-3 w-full border border-blueprint-light bg-blueprint px-4 py-2.5 font-medium hover:bg-blueprint/80"
            >
              Capture frame
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div>
              <p className="mb-2 text-sm text-muted">Photos</p>
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer border border-line px-3 py-2 text-sm hover:border-muted">
                  Upload photos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => setPhotos((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                  />
                </label>
                <label className="cursor-pointer border border-line px-3 py-2 text-sm hover:border-muted">
                  Take a photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setPhotos((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                  />
                </label>
                <button
                  type="button"
                  onClick={startScreenCapture}
                  className="border border-line px-3 py-2 text-sm hover:border-muted"
                >
                  Capture screen
                </button>
              </div>
              {photos.length > 0 && (
                <p className="mt-2 text-xs text-muted">{photos.length} photo(s) ready to upload</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm text-muted">
                360° panorama <span className="text-muted/70">(optional — enables the walkthrough view)</span>
              </p>
              <label className="block cursor-pointer border border-dashed border-line px-3 py-4 text-center text-sm hover:border-muted">
                {panorama ? panorama.name : "Upload an equirectangular photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePanoramaChange(e.target.files?.[0] ?? null)}
                />
              </label>
              {panoramaWarning && <p className="mt-1.5 text-xs text-amber">{panoramaWarning}</p>}
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full border border-blueprint-light bg-blueprint px-4 py-2.5 font-medium hover:bg-blueprint/80 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save to this room"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
