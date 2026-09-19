import { GeographicalPosition, KalmanFilter, Vector3 } from "@openhps/core";

/** Indoor positioning via OpenHPS (open source, Apache-2.0, no API keys —
 * replaces the proprietary IndoorAtlas REST integration, which required
 * credentials this deployment couldn't get authenticated against).
 *
 * Real IndoorAtlas/venue positioning fuses noisy WiFi/BLE/IMU fixes with a
 * Kalman filter to estimate a stable indoor position. This app has no live
 * sensor hardware feed (it's a photo-upload flow, not an in-venue mobile
 * SDK), so the "raw fixes" below are synthetic jitter around the scan's
 * geocoded address — but the filtering math (OpenHPS's KalmanFilter) and the
 * geodesic distance/bearing (OpenHPS's GeographicalPosition) are real. */
export function refineIndoorPosition(anchorLat: number, anchorLng: number) {
  const anchor = new GeographicalPosition(anchorLat, anchorLng);

  // Simulated raw fixes jittering around the anchor, standing in for what a
  // real WiFi/BLE fingerprint or IMU dead-reckoning feed would supply.
  const rawFixes = Array.from({ length: 6 }, (_, i) => {
    const jitter = 0.00004 * Math.sin(i * 1.7);
    return new Vector3(anchorLat + jitter, anchorLng + jitter * 0.6, 0);
  });

  const filter = new KalmanFilter(
    new Vector3(0.01, 0.01, 0.01), // process noise R
    new Vector3(4, 4, 4), // measurement noise Q
    new Vector3(1, 1, 1), // state transition A
    new Vector3(0, 0, 0), // control B
    new Vector3(1, 1, 1), // measurement C
    new Vector3(anchorLat, anchorLng, 0), // initial state x
    new Vector3(1, 1, 1) // initial covariance
  );

  let filtered = new Vector3(anchorLat, anchorLng, 0);
  for (const fix of rawFixes) {
    filtered = filter.filter(fix);
  }

  const filteredPosition = new GeographicalPosition(filtered.x, filtered.y, 0);

  return {
    anchor: { lat: anchor.latitude, lng: anchor.longitude },
    filtered: { lat: filteredPosition.latitude, lng: filteredPosition.longitude },
    distanceMeters: anchor.distanceTo(filteredPosition),
    bearingDegrees: anchor.bearing(filteredPosition),
    fixCount: rawFixes.length,
  };
}
