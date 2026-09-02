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
