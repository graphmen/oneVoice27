import type { AppState, UserAccount } from "./types";
import {
  CONFERENCE_ENTRY_EMAIL,
  CONFERENCE_ENTRY_PASSWORD,
  EZC_CONFERENCE_ID,
  GIS_DATASET,
} from "./constants";
import { seedTerritories } from "./territory-seed";
import { demoLinks } from "./ezc-index";
import { seedRegisteredChurches } from "./official-churches";

export function conferenceEntryAccount(): UserAccount {
  return {
    id: "usr_master",
    email: CONFERENCE_ENTRY_EMAIL,
    password: CONFERENCE_ENTRY_PASSWORD,
    displayName: "Dr. N. Debelem",
    role: "master_admin",
    churchIds: [],
    territoryIds: [EZC_CONFERENCE_ID],
    title: "Conference Personal Ministries",
    status: "active",
  };
}

export function createDemoState(): AppState {
  return {
    settings: {
      defaultGeofenceRadius: 80,
      organizationName: "One Voice 27",
      conferenceName: "East Zimbabwe Conference",
      divisionName: "Southern Africa-Indian Ocean Division",
      requireGeofence: true,
      exceptionRequiresApproval: true,
      allowTrainingLocation: false,
      gisDataset: GIS_DATASET,
    },
    regions: [
      { id: "reg_harare", name: "Harare", conference: "East Zimbabwe Conference" },
      { id: "reg_chitungwiza", name: "Chitungwiza District", conference: "East Zimbabwe Conference" },
      { id: "reg_ezc", name: "Conference field", conference: "East Zimbabwe Conference" },
    ],
    territories: seedTerritories(),
    churches: seedRegisteredChurches([
      {
        id: "ch_central",
        name: "Harare Central SDA Church",
        regionId: "reg_harare",
        source: "demo",
        districtId: demoLinks.harareCentralDistrictId,
        territoryId: demoLinks.centralChurchTerritoryId,
        address: "Corner Second Street & Speke Avenue",
        city: "Harare",
        lat: -17.8292,
        lng: 31.0522,
      },
      {
        id: "ch_waterfalls",
        name: "Waterfalls SDA Church",
        regionId: "reg_harare",
        districtId: demoLinks.waterfallsDistrictId,
        territoryId: demoLinks.waterfallsChurchTerritoryId,
        address: "Highfield Road, Waterfalls",
        city: "Harare",
        lat: -17.8774,
        lng: 31.0341,
        source: "demo",
      },
      {
        id: "ch_eastview",
        name: "Eastview SDA Church",
        regionId: "reg_harare",
        districtId: demoLinks.highlandsDistrictId,
        territoryId: demoLinks.eastviewChurchTerritoryId,
        address: "Enterprise Road, Highlands",
        city: "Harare",
        lat: -17.7881,
        lng: 31.0918,
        source: "demo",
      },
    ]),
    users: [conferenceEntryAccount()],
    categories: [
      {
        id: "cat_pastoral",
        name: "Pastoral Visitation",
        description: "Spiritual care, prayer, encouragement, discipleship and family support.",
        active: true,
        color: "#e400ff",
      },
      {
        id: "cat_general",
        name: "General Visitation",
        description: "Routine member engagement, welfare checks and relationship building.",
        active: true,
        color: "#9eecff",
      },
      {
        id: "cat_stewardship",
        name: "Stewardship Visitation",
        description: "Stewardship education, faithfulness and church support conversations.",
        active: true,
        color: "#ffc24a",
      },
      {
        id: "cat_crisis",
        name: "Crisis Visitation",
        description: "Bereavement, illness, emergency or family crisis.",
        active: true,
        color: "#ff5d7a",
      },
      {
        id: "cat_new",
        name: "New Member Visitation",
        description: "Newly baptized, transferred or newly registered members.",
        active: true,
        color: "#5dffb2",
      },
      {
        id: "cat_followup",
        name: "Follow-Up Visitation",
        description: "Reconnect with inactive members or digital Bible-study interests.",
        active: true,
        color: "#7aa8ff",
      },
      {
        id: "cat_other",
        name: "Other",
        description: "Administrator-configurable purpose.",
        active: true,
        color: "#c9b8ff",
      },
    ],
    members: [],
    visits: [],
    notifications: [],
    audit: [],
  };
}
