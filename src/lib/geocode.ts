export type GeocodeHit = {
  label: string;
  lat: number;
  lng: number;
};

const ZW_BBOX = "25.2,-22.5,33.1,-15.6";

function photonLabel(props: Record<string, unknown>) {
  const parts = [props.housenumber, props.street || props.name, props.district, props.city, props.state, props.country];
  return parts.filter((part) => typeof part === "string" && part.trim()).join(", ");
}

async function searchPhoton(q: string, bbox?: string): Promise<GeocodeHit[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "en");
  if (bbox) url.searchParams.set("bbox", bbox);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const data = (await res.json()) as {
    features?: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }>;
  };
  return (data.features || [])
    .map((feature) => {
      const [lng, lat] = feature.geometry?.coordinates || [];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { label: photonLabel(feature.properties || {}) || q, lat, lng };
    })
    .filter((hit): hit is GeocodeHit => Boolean(hit));
}

async function searchNominatim(q: string, zimbabweOnly: boolean): Promise<GeocodeHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", q);
  if (zimbabweOnly) url.searchParams.set("countrycodes", "zw");
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const data = (await res.json()) as Array<{ display_name?: string; lat: string; lon: string }>;
  return data
    .map((row) => {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { label: row.display_name || q, lat, lng };
    })
    .filter((hit): hit is GeocodeHit => Boolean(hit));
}

export async function searchStreet(query: string): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const local = await searchPhoton(q, ZW_BBOX);
    if (local.length) return local;
  } catch {
    /* try a wider search */
  }
  try {
    const wide = await searchPhoton(q);
    if (wide.length) return wide;
  } catch {
    /* Nominatim fallback */
  }
  try {
    const zw = await searchNominatim(q, true);
    if (zw.length) return zw;
  } catch {
    /* last try */
  }
  return searchNominatim(q, false);
}

export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const raw = text.trim().replace(/\u00b0/g, "");
  const pair = raw.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!pair) return null;
  return validCoordinates(Number(pair[1]), Number(pair[2]));
}

export function validCoordinates(lat: number, lng: number): { lat: number; lng: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function gpsFailureMessage(err: GeolocationPositionError | null) {
  if (!err) return "Allow location to pin this home, or enter coordinates / pin by hand.";
  if (err.code === err.PERMISSION_DENIED) {
    return "Location permission is off. Allow it, or enter coordinates / pin the house on the map.";
  }
  if (err.code === err.TIMEOUT) {
    return "GPS timed out. Move outdoors, try again, or enter coordinates.";
  }
  return "Could not read GPS. Enter coordinates or pin the house on the map.";
}
