export type Role = "master_admin" | "church_admin" | "pastor";

export type VisitFrequency =
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "biannually"
  | "annually"
  | "custom";

export type Priority = "high" | "medium" | "normal";

export type MemberType = "regular" | "new" | "followup" | "crisis" | "inactive";

export type VisitStatus =
  | "scheduled"
  | "geofence_entered"
  | "completed"
  | "exception_pending"
  | "exception_approved"
  | "exception_rejected";

export type LocationVerification = "verified" | "unverified" | "manual";

export type TerritoryLevel =
  | "general_conference"
  | "division"
  | "union"
  | "conference"
  | "district"
  | "church";

/** GeoJSON position: [longitude, latitude] */
export type LngLat = [number, number];

export interface GeoPolygon {
  type: "Polygon";
  coordinates: LngLat[][];
}

export interface GeoMultiPolygon {
  type: "MultiPolygon";
  coordinates: LngLat[][][];
}

export type TerritoryGeometry = GeoPolygon | GeoMultiPolygon;

export type OfficialBoundarySource = "ezc_boundary" | "harare_district" | "church_territory";

export interface Territory {
  id: string;
  name: string;
  shortName?: string;
  level: TerritoryLevel;
  parentId?: string;
  geometry?: TerritoryGeometry;
  color: string;
  churchId?: string;
  assignedPastorIds: string[];
  notes?: string;
  officialSource?: OfficialBoundarySource;
  sourceFeatureIndex?: number;
  geometryOverride?: boolean;
  pin?: { lat: number; lng: number };
}

export interface Region {
  id: string;
  name: string;
  conference: string;
}

export interface Church {
  id: string;
  name: string;
  regionId: string;
  districtId?: string;
  territoryId?: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
}

export interface UserAccount {
  id: string;
  email: string;
  password?: string;
  displayName: string;
  role: Role;
  churchIds: string[];
  territoryIds?: string[];
  phone?: string;
  title?: string;
  status: "active" | "inactive";
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  churchId: string;
  assignedPastorId?: string;
  phone?: string;
  email?: string;
  address: string;
  suburb?: string;
  lat: number;
  lng: number;
  geofenceRadius: number;
  visitationFrequency: VisitFrequency;
  customFrequencyDays?: number;
  lastVisitAt?: string;
  nextVisitDue: string;
  memberType: MemberType;
  adminNotes?: string;
  status: "active" | "inactive";
  baptizedAt?: string;
  createdAt: string;
}

export interface VisitCategory {
  id: string;
  name: string;
  description: string;
  active: boolean;
  color: string;
}

export interface Visit {
  id: string;
  memberId: string;
  pastorId: string;
  churchId: string;
  categoryId: string;
  status: VisitStatus;
  scheduledAt?: string;
  geofenceEnteredAt?: string;
  completedAt?: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  locationVerification: LocationVerification;
  geofenceStatus: "entered" | "not_entered" | "unknown";
  adminNotes?: string;
  confidentialNotes?: string;
  followUpRequired: boolean;
  prayerRequest?: string;
  referralRequired: boolean;
  nextVisitRecommendation?: string;
  urgency?: Priority;
  durationMinutes?: number;
  exceptionReason?: string;
  exceptionApprovedBy?: string;
  exceptionReviewedAt?: string;
  trainingOverride?: boolean;
  prayed?: boolean;
  bibleStudy?: boolean;
  baptismInterest?: boolean;
  decisionMade?: boolean;
  referred?: boolean;
  followUpAt?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: "due" | "reminder" | "geofence" | "overdue" | "exception" | "system";
  read: boolean;
  createdAt: string;
  href?: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AppSettings {
  defaultGeofenceRadius: number;
  organizationName: string;
  conferenceName: string;
  divisionName: string;
  requireGeofence: boolean;
  exceptionRequiresApproval: boolean;
  allowTrainingLocation: boolean;
  gisDataset?: string;
}

export interface AppState {
  regions: Region[];
  territories: Territory[];
  churches: Church[];
  users: UserAccount[];
  members: Member[];
  categories: VisitCategory[];
  visits: Visit[];
  notifications: AppNotification[];
  audit: AuditLog[];
  settings: AppSettings;
}

export type GpsFix = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};
