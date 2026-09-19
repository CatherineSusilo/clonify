"use client";

import { useEffect, useState } from "react";

export type TrackingConfidence = "available" | "permission-required" | "unavailable";

type DeviceOrientationWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export function normalizeHeading(value: number) {
  return ((Math.round(value) % 360) + 360) % 360;
}

export function DeviceMotionHeading({ onHeading, onConfidence }: { onHeading: (heading: number | null) => void; onConfidence: (confidence: TrackingConfidence) => void }) {
  const [needsPermission, setNeedsPermission] = useState(false);

  useEffect(() => {
    const source = DeviceOrientationEvent as DeviceOrientationWithPermission;
    if (!source) {
      onConfidence("unavailable");
      return;
    }
    if (source.requestPermission) {
      const timer = window.setTimeout(() => {
        setNeedsPermission(true);
        onConfidence("permission-required");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const updateHeading = (event: DeviceOrientationEvent) => {
      if (typeof event.alpha !== "number") return;
      onHeading(normalizeHeading(360 - event.alpha));
      onConfidence("available");
    };
    window.addEventListener("deviceorientation", updateHeading);
    return () => window.removeEventListener("deviceorientation", updateHeading);
  }, [onConfidence, onHeading]);

  async function requestMotionPermission() {
    const source = DeviceOrientationEvent as DeviceOrientationWithPermission;
    if (!source.requestPermission) return;
    const permission = await source.requestPermission();
    if (permission !== "granted") {
      onConfidence("unavailable");
      return;
    }
    setNeedsPermission(false);
    onConfidence("available");
  }

  if (!needsPermission) return null;
  return <button type="button" aria-label="Enable motion heading" title="Enable motion heading" onClick={requestMotionPermission} className="grid h-11 w-11 place-items-center rounded-full border border-line text-blueprint-light hover:bg-blueprint-light/10">◉</button>;
}
