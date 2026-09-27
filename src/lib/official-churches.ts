import catalog from "./official-churches.json";
import type { Church } from "./types";

type OfficialRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  districtId?: string | null;
  territoryId?: string | null;
  city: string;
  source: "field_gps";
};

function regionFor(districtId?: string | null, city?: string) {
  if (districtId?.startsWith("hdist_")) return "reg_harare";
  const blob = `${districtId || ""} ${city || ""}`.toLowerCase();
  if (blob.includes("chitungwiza") || blob.includes("seke") || blob.includes("zengeza")) {
    return "reg_chitungwiza";
  }
  return "reg_ezc";
}

export const OFFICIAL_CHURCH_CATALOG = catalog.version;

export function officialFieldChurches(): Church[] {
  return (catalog.churches as OfficialRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    regionId: regionFor(row.districtId, row.city),
    districtId: row.districtId || undefined,
    territoryId: row.territoryId || undefined,
    address: "Field GPS pin",
    city: row.city || "East Zimbabwe Conference",
    lat: row.lat,
    lng: row.lng,
    source: "field_gps",
  }));
}

export function officialChurchIdByTerritory() {
  const map = new Map<string, string>();
  for (const church of officialFieldChurches()) {
    if (church.territoryId && !map.has(church.territoryId)) {
      map.set(church.territoryId, church.id);
    }
  }
  return map;
}

export function seedRegisteredChurches(demo: Church[]): Church[] {
  const seen = new Set(demo.map((c) => c.id));
  return [...demo, ...officialFieldChurches().filter((c) => !seen.has(c.id))];
}
