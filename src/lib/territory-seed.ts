import { demoLinks, ezcIndex } from "./ezc-index";
import type { Territory } from "./types";

export const LEGACY_TERRITORY_IDS: Record<string, string> = {
  dist_harare_metro: demoLinks.harareCentralDistrictId,
  dist_harare_south: demoLinks.waterfallsDistrictId,
  dist_harare_east: demoLinks.highlandsDistrictId,
  ter_ch_central: demoLinks.centralChurchTerritoryId,
  ter_ch_waterfalls: demoLinks.waterfallsChurchTerritoryId,
  ter_ch_eastview: demoLinks.eastviewChurchTerritoryId,
};

export function remapLegacyTerritoryId(id?: string) {
  if (!id) return id;
  return LEGACY_TERRITORY_IDS[id] || id;
}

export function seedTerritories(): Territory[] {
  const tendai = ["usr_pastor_tendai"];
  const grace = ["usr_pastor_grace"];
  const john = ["usr_pastor_john"];

  const assignedFor = (id: string) => {
    if (id === demoLinks.harareCentralDistrictId || id === demoLinks.centralChurchTerritoryId) return tendai;
    if (id === demoLinks.waterfallsDistrictId || id === demoLinks.waterfallsChurchTerritoryId) return grace;
    if (id === demoLinks.highlandsDistrictId || id === demoLinks.eastviewChurchTerritoryId) return john;
    return [];
  };

  const units: Territory[] = [
    {
      id: ezcIndex.gc.id,
      name: ezcIndex.gc.name,
      shortName: ezcIndex.gc.shortName,
      level: "general_conference",
      color: "#9eecff",
      assignedPastorIds: [],
      notes: "Organisational level only. No polygon — the boundaries folder does not include a General Conference GIS file.",
    },
    {
      id: ezcIndex.division.id,
      name: ezcIndex.division.name,
      shortName: ezcIndex.division.shortName,
      level: "division",
      parentId: ezcIndex.gc.id,
      color: "#7aa8ff",
      assignedPastorIds: [],
      notes: "Organisational level only. No SID polygon was supplied in the boundaries folder.",
    },
    {
      id: ezcIndex.union.id,
      name: ezcIndex.union.name,
      shortName: ezcIndex.union.shortName,
      level: "union",
      parentId: ezcIndex.division.id,
      color: "#c9b8ff",
      assignedPastorIds: [],
      notes: "Organisational level only. No ZUC polygon was supplied in the boundaries folder.",
    },
    {
      id: ezcIndex.conference.id,
      name: ezcIndex.conference.name,
      shortName: ezcIndex.conference.shortName,
      level: "conference",
      parentId: ezcIndex.union.id,
      color: "#e400ff",
      assignedPastorIds: [],
      officialSource: "ezc_boundary",
      notes: "Polygon from your file boundaries/ezc_boundary.geojson (East Zimbabwe Conference coverage).",
    },
  ];

  for (const district of ezcIndex.harareDistricts) {
    units.push({
      id: district.id,
      name: district.name,
      shortName: district.shortName,
      level: "district",
      parentId: ezcIndex.conference.id,
      color: district.color,
      assignedPastorIds: assignedFor(district.id),
      officialSource: "harare_district",
      sourceFeatureIndex: district.featureIndex,
      notes: district.pastorName
        ? `Polygon from your file boundaries/harare_boundaries.geojson. Field pastor on that map: ${district.pastorName}.`
        : "Polygon from your file boundaries/harare_boundaries.geojson.",
    });
  }

  for (const district of ezcIndex.coverageDistricts) {
    units.push({
      id: district.id,
      name: district.name,
      shortName: district.shortName,
      level: "district",
      parentId: ezcIndex.conference.id,
      color: district.color,
      assignedPastorIds: [],
      officialSource: "ezc_boundary",
      sourceFeatureIndex: district.featureIndex,
      notes: district.adm1
        ? `Polygon from your file boundaries/ezc_boundary.geojson (${district.adm1}).`
        : "Polygon from your file boundaries/ezc_boundary.geojson.",
    });
  }

  for (const church of ezcIndex.churches) {
    const churchId =
      church.id === demoLinks.centralChurchTerritoryId
        ? "ch_central"
        : church.id === demoLinks.waterfallsChurchTerritoryId
          ? "ch_waterfalls"
          : church.id === demoLinks.eastviewChurchTerritoryId
            ? "ch_eastview"
            : undefined;
    units.push({
      id: church.id,
      name: church.name,
      shortName: church.shortName,
      level: "church",
      parentId: church.parentId,
      churchId,
      color: church.color,
      assignedPastorIds: assignedFor(church.id),
      officialSource: "church_territory",
      sourceFeatureIndex: church.featureIndex,
      pin: church.pin,
      notes: `Polygon from your file boundaries/church_territories_official.geojson (${church.civicDistrict}).`,
    });
  }

  return units;
}
