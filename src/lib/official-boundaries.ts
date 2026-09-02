import { ezcIndex } from "./ezc-index";
import { mergeFeatureCollection, parseGeoJsonGeometry } from "./gis";
import type { Territory, TerritoryGeometry } from "./types";

type GeoFeature = {
  geometry?: unknown;
  properties?: Record<string, unknown>;
};

type FeatureCollection = {
  features?: GeoFeature[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  return (await res.json()) as T;
}

function featureGeometry(feature: GeoFeature | undefined): TerritoryGeometry | undefined {
  if (!feature) return undefined;
  return parseGeoJsonGeometry(feature) ?? undefined;
}

export async function attachOfficialGeometries(territories: Territory[]): Promise<Territory[]> {
  const [ezc, harare, churches] = await Promise.all([
    fetchJson<FeatureCollection>(ezcIndex.files.conference),
    fetchJson<FeatureCollection>(ezcIndex.files.harareDistricts),
    fetchJson<FeatureCollection>(ezcIndex.files.churches),
  ]);

  const byId = new Map<string, TerritoryGeometry>();
  const conference = mergeFeatureCollection(ezc);
  if (conference) byId.set(ezcIndex.conference.id, conference);

  for (const district of ezcIndex.harareDistricts) {
    const geom = featureGeometry(harare.features?.[district.featureIndex]);
    if (geom) byId.set(district.id, geom);
  }

  for (const district of ezcIndex.coverageDistricts) {
    if (district.featureIndex == null) continue;
    const geom = featureGeometry(ezc.features?.[district.featureIndex]);
    if (geom) byId.set(district.id, geom);
  }

  for (const church of ezcIndex.churches) {
    const geom = featureGeometry(churches.features?.[church.featureIndex]);
    if (geom) byId.set(church.id, geom);
  }

  return territories.map((territory) => {
    if (territory.geometryOverride && territory.geometry) return territory;
    const geometry = byId.get(territory.id);
    return geometry ? { ...territory, geometry } : territory;
  });
}

export function stripOfficialGeometry(territories: Territory[]): Territory[] {
  return territories.map((territory) => {
    if (territory.officialSource && !territory.geometryOverride) {
      const { geometry: _geometry, ...rest } = territory;
      return rest;
    }
    return territory;
  });
}
