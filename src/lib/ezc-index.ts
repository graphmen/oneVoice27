import raw from "./ezc-index.json";

export type EzcPin = { lat: number; lng: number };

export type EzcNamedUnit = {
  id: string;
  name: string;
  shortName: string;
  code?: string;
};

export type EzcHarareDistrict = {
  id: string;
  name: string;
  shortName: string;
  pastorName?: string | null;
  color: string;
  featureIndex: number;
};

export type EzcCoverageDistrict = {
  id: string;
  name: string;
  shortName: string;
  adm1?: string;
  color: string;
  featureIndex?: number;
  adm2Name?: string;
};

export type EzcChurchRow = {
  id: string;
  name: string;
  shortName: string;
  parentId: string;
  civicDistrict: string;
  sourceChurchId: string;
  color: string;
  pin?: EzcPin;
  featureIndex: number;
};

export type EzcDemoLinks = {
  conferenceId: string;
  harareCentralDistrictId: string;
  waterfallsDistrictId: string;
  highlandsDistrictId: string;
  centralChurchTerritoryId: string;
  waterfallsChurchTerritoryId: string;
  eastviewChurchTerritoryId: string;
  centralChurchName: string;
  waterfallsChurchName: string;
  eastviewChurchName: string;
};

export type EzcIndex = {
  version: string;
  pitch: string;
  files: {
    conference: string;
    harareDistricts: string;
    churches: string;
  };
  bbox: [number, number, number, number];
  gc: EzcNamedUnit;
  division: EzcNamedUnit;
  union: EzcNamedUnit;
  conference: EzcNamedUnit;
  harareDistricts: EzcHarareDistrict[];
  coverageDistricts: EzcCoverageDistrict[];
  churches: EzcChurchRow[];
  demoLinks: EzcDemoLinks;
  counts: {
    harareDistricts: number;
    coverageDistricts: number;
    churches: number;
  };
};

export const ezcIndex = raw as EzcIndex;
export const demoLinks = ezcIndex.demoLinks;
