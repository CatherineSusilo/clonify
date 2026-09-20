"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomSummary } from "./RoomsPanel";

type Props = {
  route: RoomSummary[];
  onClose?: () => void;
};

export function LiveNavigationCamera({ route, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [guidance, setGuidance] = useState("Connect a camera to begin live building guidance.");
  const [speaking, setSpeaking] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [locationStatus, setLocationStatus] = useState("LOCATION PENDING");
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (!connected || route.length < 2) return;
    const next = route[Math.min(step, route.length - 1)];
    const previous = route[Math.max(0, step - 1)];
    let cancelled = false;
    fetch("/api/navigation/guidance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: previous.name,
        nextRoom: next.name,
        to: route[route.length - 1].name,
        floor: next.floor,
        step,
        totalSteps: route.length - 1,
        reroute: rerouting,
      }),
    })
      .then((response) => response.json() as Promise<{ text?: string }>)
      .then((data) => {
        if (!cancelled && data.text) setGuidance(data.text);
      })
      .catch(() => {
        if (!cancelled) setGuidance(`Continue toward ${next.name}.`);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, rerouting, route, step]);

  useEffect(() => {
    if (!connected) return;
    let locationTimer: number | undefined;
    if (!navigator.geolocation) {
      locationTimer = window.setTimeout(() => setLocationStatus("LOCATION UNAVAILABLE"), 0);
    } else {
      navigator.geolocation.getCurrentPosition(
        () => setLocationStatus("POSITION SYNCED"),
        () => setLocationStatus("LOCATION DENIED"),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
    const updateHeading = (event: DeviceOrientationEvent) => {
      if (typeof event.alpha === "number") setHeading(Math.round((360 - event.alpha + 360) % 360));
    };
    window.addEventListener("deviceorientation", updateHeading);
    return () => {
      if (locationTimer) window.clearTimeout(locationTimer);
      window.removeEventListener("deviceorientation", updateHeading);
    };
  }, [connected]);

  async function connectCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not expose a camera connection.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setConnected(true);
      setLocationStatus("REQUESTING POSITION");
      setGuidance("Camera connected. Hold steady while Clonify aligns your position.");
    } catch {
      setError("Camera permission was denied. Allow camera access to use live guidance.");
    } finally {
      setBusy(false);
    }
  }

  function disconnectCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setConnected(false);
    setLocationStatus("LOCATION PENDING");
    setHeading(null);
    setGuidance("Connect a camera to begin live building guidance.");
    setSpeaking(false);
    window.speechSynthesis?.cancel();
  }

  function speakGuidance() {
    if (!("speechSynthesis" in window)) {
      setError("Text-to-speech is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(guidance);
    utterance.rate = 0.92;
    utterance.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function simulateProgress() {
    if (step < route.length - 1) {
      setRerouting(false);
      setStep((current) => current + 1);
      return;
    }
    setRerouting(true);
    setStep(1);
  }

  return (
    <section className="live-camera-shell" aria-label="Live camera navigation">
      <div className="live-camera-feed">
        <video ref={videoRef} autoPlay playsInline muted aria-label="Connected live camera feed" />
        {!connected && <div className="live-camera-empty"><span className="live-camera-icon">◉</span><p>Live camera is required for this POV</p><span>Connect your phone camera, smart glasses, or compatible camera feed.</span></div>}
        {connected && <div className="guidance-overlay">
          <div className="guidance-topline"><span><span className="live-dot" /> LIVE ALIGNMENT</span><span className="confidence">{locationStatus} · {heading == null ? "HEADING PENDING" : `${heading}°`} · 94% METRIC</span></div>
          <div className="guidance-arrow" aria-hidden="true">↑</div>
          <div className="guidance-card"><span className="eyebrow">{rerouting ? "REROUTING" : `NEXT · STEP ${step}/${route.length - 1}`}</span><strong>{guidance}</strong><span className="text-xs text-muted">{rerouting ? "Path recalculated from your current building position" : "Visual + motion alignment active"}</span></div>
          <div className="guidance-bottom"><span>↗ {Math.max(8, (route.length - step) * 18)} ft</span><span>⌖ {route[route.length - 1]?.name}</span></div>
        </div>}
      </div>
      <div className="live-camera-controls">
        <div><p className="eyebrow">Connected camera</p><p className="text-sm text-muted">{connected ? "Feed active · building position synced" : "Permission required before live navigation can start"}</p></div>
        <div className="flex flex-wrap gap-2">
          {!connected ? <button type="button" onClick={connectCamera} disabled={busy} className="primary-button">{busy ? "Requesting access…" : "Connect camera"}</button> : <><button type="button" onClick={speakGuidance} className="secondary-button">{speaking ? "Speaking…" : "Speak direction"}</button><button type="button" onClick={simulateProgress} className="secondary-button">Simulate next turn</button><button type="button" onClick={disconnectCamera} className="secondary-button">Disconnect</button></>}
          {onClose && <button type="button" onClick={onClose} className="secondary-button">Close POV</button>}
        </div>
        {error && <p className="basis-full text-sm text-danger" role="alert">{error}</p>}
      </div>
    </section>
  );
}
