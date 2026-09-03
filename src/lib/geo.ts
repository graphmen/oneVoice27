import type { GpsFix } from "./types";

const EARTH_M = 6_371_000;

export function toRad(d: number) {
  return (d * Math.PI) / 180;
}

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function insideGeofence(
  pastor: Pick<GpsFix, "lat" | "lng">,
  member: { lat: number; lng: number; geofenceRadius: number },
) {
  const distance = haversineMeters(pastor.lat, pastor.lng, member.lat, member.lng);
  return { distance, inside: distance <= member.geofenceRadius };
}

export function watchGps(
  onFix: (fix: GpsFix) => void,
  onError: (message: string) => void,
) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError("This device does not support GPS location.");
    return () => {};
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onFix({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
        heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
        speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
      });
    },
    (err) => {
      onError(err.message || "Unable to read GPS. Check location permission.");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 20_000,
    },
  );

  return () => navigator.geolocation.clearWatch(id);
}

export function bearingDegrees(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const y = Math.sin(toRad(toLng - fromLng)) * Math.cos(toRad(toLat));
  const x =
    Math.cos(toRad(fromLat)) * Math.sin(toRad(toLat)) -
    Math.sin(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.cos(toRad(toLng - fromLng));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function formatMeters(m: number) {
  if (m < 1000) return `${Math.max(1, Math.round(m))} m`;
  return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`;
}

export function formatDuration(seconds: number) {
  const m = Math.max(1, Math.round(seconds / 60));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function nearestDistance(points: { lat: number; lng: number }[], here: { lat: number; lng: number }) {
  let best = Infinity;
  let index = 0;
  for (let i = 0; i < points.length; i++) {
    const d = haversineMeters(here.lat, here.lng, points[i].lat, points[i].lng);
    if (d < best) {
      best = d;
      index = i;
    }
  }
  return { distance: best, index };
}

export function remainingMeters(points: { lat: number; lng: number }[], here: { lat: number; lng: number }) {
  if (points.length < 2) {
    return points[0] ? haversineMeters(here.lat, here.lng, points[0].lat, points[0].lng) : 0;
  }
  const { index } = nearestDistance(points, here);
  let rest = haversineMeters(here.lat, here.lng, points[index].lat, points[index].lng);
  for (let i = index; i < points.length - 1; i++) {
    rest += haversineMeters(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  return rest;
}
