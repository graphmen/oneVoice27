import type {
  Church,
  LngLat,
  Member,
  Territory,
  TerritoryGeometry,
  TerritoryLevel,
  UserAccount,
} from "./types";
import { haversineMeters } from "./geo";

export const TERRITORY_LEVELS: TerritoryLevel[] = [
  "general_conference",
  "division",
  "union",
  "conference",
  "district",
  "church",
];

export const LEVEL_SHORT: Record<TerritoryLevel, string> = {
  general_conference: "GC",
  division: "Div",
  union: "Union",
  conference: "Conf",
  district: "Dist",
  church: "Ch",
};

export const LEVEL_LABEL: Record<TerritoryLevel, string> = {
  general_conference: "General Conference",
  division: "Division",
  union: "Union",
  conference: "Local Conference",
  district: "District",
  church: "Church",
};

export const LEVEL_PARENT: Record<TerritoryLevel, TerritoryLevel | null> = {
  general_conference: null,
  division: "general_conference",
  union: "division",
  conference: "union",
  district: "conference",
  church: "district",
};

export const LEVEL_WEIGHT: Record<TerritoryLevel, number> = {
  general_conference: 1,
  division: 2,
  union: 3,
  conference: 4,
  district: 5,
  church: 6,
};

const EARTH_M = 6_371_000;

export function ring(points: LngLat[]): LngLat[] {
  if (!points.length) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return points;
  return [...points, first];
}

export function polygon(points: LngLat[]): TerritoryGeometry {
  return { type: "Polygon", coordinates: [ring(points)] };
}

export function circlePolygon(lat: number, lng: number, radiusM: number, steps = 24): TerritoryGeometry {
  const coords: LngLat[] = [];
  const latRad = (lat * Math.PI) / 180;
  for (let i = 0; i <= steps; i++) {
    const brng = (i / steps) * 2 * Math.PI;
    const dLat = (radiusM / EARTH_M) * Math.cos(brng);
    const dLng = (radiusM / (EARTH_M * Math.max(0.2, Math.cos(latRad)))) * Math.sin(brng);
    coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

function ringContains(r: LngLat[], lng: number, lat: number) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0];
    const yi = r[i][1];
    const xj = r[j][0];
    const yj = r[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonContains(coords: LngLat[][], lng: number, lat: number) {
  if (!coords[0] || !ringContains(coords[0], lng, lat)) return false;
  for (let h = 1; h < coords.length; h++) {
    if (ringContains(coords[h], lng, lat)) return false;
  }
  return true;
}

export function geometryContains(geometry: TerritoryGeometry | undefined, lat: number, lng: number) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") return polygonContains(geometry.coordinates, lng, lat);
  return geometry.coordinates.some((poly) => polygonContains(poly, lng, lat));
}

export function pointInTerritory(territory: Territory, lat: number, lng: number) {
  return geometryContains(territory.geometry, lat, lng);
}

export function containingTerritories(territories: Territory[], lat: number, lng: number) {
  return territories
    .filter((t) => pointInTerritory(t, lat, lng))
    .sort((a, b) => LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level]);
}

export function territoryAtLevel(territories: Territory[], lat: number, lng: number, level: TerritoryLevel) {
  return containingTerritories(territories, lat, lng).find((t) => t.level === level);
}

export function geometryBBox(geometry?: TerritoryGeometry): [number, number, number, number] | null {
  if (!geometry) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  const walk = (pts: LngLat[]) => {
    for (const [lng, lat] of pts) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  };
  if (geometry.type === "Polygon") geometry.coordinates.forEach(walk);
  else geometry.coordinates.forEach((poly) => poly.forEach(walk));
  if (!Number.isFinite(minLng)) return null;
  return [minLat, minLng, maxLat, maxLng];
}

export function geometryCentroid(geometry?: TerritoryGeometry): { lat: number; lng: number } | null {
  if (!geometry) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  const walk = (pts: LngLat[]) => {
    const limit = pts.length > 1 ? pts.length - 1 : pts.length;
    for (let i = 0; i < limit; i++) {
      sx += pts[i][0];
      sy += pts[i][1];
      n += 1;
    }
  };
  if (geometry.type === "Polygon") walk(geometry.coordinates[0] || []);
  else geometry.coordinates.forEach((poly) => walk(poly[0] || []));
  if (!n) return null;
  return { lng: sx / n, lat: sy / n };
}

export function geometryAreaKm2(geometry?: TerritoryGeometry) {
  if (!geometry) return 0;
  const rings = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let area = 0;
  for (const poly of rings) {
    area += Math.abs(ringAreaKm2(poly[0] || []));
    for (let h = 1; h < poly.length; h++) area -= Math.abs(ringAreaKm2(poly[h] || []));
  }
  return Math.max(0, area);
}

function ringAreaKm2(r: LngLat[]) {
  if (r.length < 4) return 0;
  let sum = 0;
  for (let i = 0; i < r.length - 1; i++) {
    const [lng1, lat1] = r[i];
    const [lng2, lat2] = r[i + 1];
    sum += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return (sum * EARTH_M * EARTH_M) / 2_000_000;
}

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

export function childrenOf(territories: Territory[], parentId?: string) {
  return territories
    .filter((t) => (parentId ? t.parentId === parentId : !t.parentId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function ancestors(territories: Territory[], id?: string) {
  const byId = new Map(territories.map((t) => [t.id, t]));
  const path: Territory[] = [];
  let cur = id ? byId.get(id) : undefined;
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

export function descendantIds(territories: Territory[], rootId: string) {
  const ids = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const t of territories) {
      if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) {
        ids.add(t.id);
        added = true;
      }
    }
  }
  return ids;
}

export function churchesInTerritory(territory: Territory, territories: Territory[], churches: Church[]) {
  const ids = descendantIds(territories, territory.id);
  return churches.filter((c) => {
    if (c.districtId && ids.has(c.districtId)) return true;
    if (c.territoryId && ids.has(c.territoryId)) return true;
    if (territory.churchId === c.id) return true;
    return pointInTerritory(territory, c.lat, c.lng);
  });
}

export function membersInTerritory(
  territory: Territory,
  territories: Territory[],
  churches: Church[],
  members: Member[],
) {
  const churchIds = new Set(churchesInTerritory(territory, territories, churches).map((c) => c.id));
  return members.filter((m) => churchIds.has(m.churchId) || pointInTerritory(territory, m.lat, m.lng));
}

export function pastorsForTerritory(territory: Territory, territories: Territory[], users: UserAccount[]) {
  const ids = descendantIds(territories, territory.id);
  const fromTree = new Set<string>();
  for (const t of territories) {
    if (!ids.has(t.id)) continue;
    t.assignedPastorIds.forEach((id) => fromTree.add(id));
  }
  return users.filter(
    (u) =>
      u.role === "pastor" &&
      (fromTree.has(u.id) || u.territoryIds?.some((id) => ids.has(id))),
  );
}

export function nearestChurch(churches: Church[], lat: number, lng: number) {
  if (!churches.length) return null;
  return churches
    .map((c) => ({ c, d: haversineMeters(lat, lng, c.lat, c.lng) }))
    .sort((a, b) => a.d - b.d)[0];
}

export function parseGeoJsonGeometry(raw: unknown): TerritoryGeometry | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { type?: string; coordinates?: unknown; geometry?: unknown };
  if (obj.type === "Feature") return parseGeoJsonGeometry(obj.geometry);
  if (obj.type === "FeatureCollection") return mergeFeatureCollection(raw);
  if (obj.type === "Polygon" && Array.isArray(obj.coordinates)) {
    return { type: "Polygon", coordinates: obj.coordinates as LngLat[][] };
  }
  if (obj.type === "MultiPolygon" && Array.isArray(obj.coordinates)) {
    return { type: "MultiPolygon", coordinates: obj.coordinates as LngLat[][][] };
  }
  return null;
}

export function mergeGeometries(geoms: TerritoryGeometry[]): TerritoryGeometry | null {
  const parts: LngLat[][][] = [];
  for (const g of geoms) {
    if (g.type === "Polygon") parts.push(g.coordinates);
    else parts.push(...g.coordinates);
  }
  if (!parts.length) return null;
  if (parts.length === 1) return { type: "Polygon", coordinates: parts[0] };
  return { type: "MultiPolygon", coordinates: parts };
}

export function mergeFeatureCollection(raw: unknown): TerritoryGeometry | null {
  if (!raw || typeof raw !== "object") return null;
  const features = (raw as { type?: string; features?: unknown[] }).features;
  if (!Array.isArray(features) || !features.length) return null;
  const geoms = features
    .map((feature) => parseGeoJsonGeometry(feature))
    .filter((g): g is TerritoryGeometry => Boolean(g));
  return mergeGeometries(geoms);
}

export function toFeatureCollection(territories: Territory[]) {
  return {
    type: "FeatureCollection" as const,
    features: territories
      .filter((t) => t.geometry)
      .map((t) => ({
        type: "Feature" as const,
        properties: {
          id: t.id,
          name: t.name,
          level: t.level,
          parentId: t.parentId || "",
          color: t.color,
        },
        geometry: t.geometry,
      })),
  };
}
