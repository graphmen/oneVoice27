import type { Church, Member, MemberType, UserAccount, VisitFrequency } from "./types";
import { computeNextDue, uid } from "./utils";

export type MemberImportRow = {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address: string;
  suburb?: string;
  lat?: number;
  lng?: number;
  churchId: string;
  assignedPastorId?: string;
  visitationFrequency: VisitFrequency;
  memberType: MemberType;
  errors: string[];
};

export type MemberImportPreview = {
  rows: MemberImportRow[];
  valid: MemberImportRow[];
  errorCount: number;
};

const FREQ: Record<string, VisitFrequency> = {
  monthly: "monthly",
  bimonthly: "bimonthly",
  quarterly: "quarterly",
  biannually: "biannually",
  annually: "annually",
  custom: "custom",
  month: "monthly",
  quarter: "quarterly",
  year: "annually",
};

const TYPES: Record<string, MemberType> = {
  regular: "regular",
  new: "new",
  followup: "followup",
  follow: "followup",
  crisis: "crisis",
  inactive: "inactive",
};

function norm(value: unknown) {
  return String(value ?? "").trim();
}

function key(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function num(value: unknown) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function splitName(full: string) {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function cell(row: Record<string, unknown>, ...aliases: string[]) {
  const map = new Map(Object.keys(row).map((k) => [key(k), row[k]]));
  for (const alias of aliases) {
    const hit = map.get(key(alias));
    if (hit != null && String(hit).trim()) return hit;
  }
  return "";
}

function matchChurch(name: string, churches: Church[], fallback: string) {
  if (!name) return fallback;
  const exact = churches.find((c) => c.id === name || c.name.toLowerCase() === name.toLowerCase());
  if (exact) return exact.id;
  const needle = name.toLowerCase();
  const fuzzy = churches.find((c) => c.name.toLowerCase().includes(needle) || needle.includes(c.name.toLowerCase()));
  return fuzzy?.id || fallback;
}

function matchPastor(name: string, pastors: UserAccount[]) {
  if (!name) return undefined;
  const exact = pastors.find((p) => p.id === name || p.email.toLowerCase() === name.toLowerCase());
  if (exact) return exact.id;
  const needle = name.toLowerCase();
  return pastors.find((p) => p.displayName.toLowerCase().includes(needle))?.id;
}

export function rowsToPreview(
  rawRows: Record<string, unknown>[],
  opts: {
    defaultChurchId: string;
    defaultPastorId?: string;
    churches: Church[];
    pastors: UserAccount[];
  },
): MemberImportPreview {
  const rows = rawRows
    .map((row) => {
      const full = norm(cell(row, "name", "full name", "member"));
      const split = splitName(full);
      const firstName = norm(cell(row, "first name", "firstname", "given")) || split.firstName;
      const lastName = norm(cell(row, "last name", "lastname", "surname")) || split.lastName;
      const address = norm(cell(row, "address", "home", "street")) || "Address not captured";
      const churchId = matchChurch(norm(cell(row, "church", "church id", "congregation")), opts.churches, opts.defaultChurchId);
      const assignedPastorId =
        matchPastor(norm(cell(row, "pastor", "shepherd", "assigned pastor", "pastor id")), opts.pastors) ||
        opts.defaultPastorId;
      const freqRaw = norm(cell(row, "frequency", "visitation frequency")).toLowerCase();
      const typeRaw = norm(cell(row, "type", "member type")).toLowerCase();
      const lat = num(cell(row, "lat", "latitude"));
      const lng = num(cell(row, "lng", "lon", "longitude"));
      const errors: string[] = [];
      if (!firstName) errors.push("Missing first name");
      if (!lastName) errors.push("Missing last name");
      if (!churchId) errors.push("No church selected");
      const parsed: MemberImportRow = {
        firstName,
        lastName,
        phone: norm(cell(row, "phone", "mobile", "cell")) || undefined,
        email: norm(cell(row, "email")) || undefined,
        address,
        suburb: norm(cell(row, "suburb", "area")) || undefined,
        lat,
        lng,
        churchId,
        assignedPastorId,
        visitationFrequency: FREQ[freqRaw] || "quarterly",
        memberType: TYPES[typeRaw] || "regular",
        errors,
      };
      return parsed;
    })
    .filter((row) => row.firstName || row.lastName || row.phone);
  const valid = rows.filter((r) => r.errors.length === 0);
  return { rows, valid, errorCount: rows.length - valid.length };
}

export function importRowsToMembers(
  rows: MemberImportRow[],
  defaults: { lat: number; lng: number; geofenceRadius: number },
): Member[] {
  const now = new Date().toISOString();
  return rows.map((row) => ({
    id: uid("mem"),
    firstName: row.firstName,
    lastName: row.lastName,
    churchId: row.churchId,
    assignedPastorId: row.assignedPastorId,
    phone: row.phone,
    email: row.email,
    address: row.address,
    suburb: row.suburb,
    lat: row.lat ?? defaults.lat,
    lng: row.lng ?? defaults.lng,
    geofenceRadius: defaults.geofenceRadius,
    visitationFrequency: row.visitationFrequency,
    nextVisitDue: computeNextDue(undefined, row.visitationFrequency),
    memberType: row.memberType,
    status: "active",
    createdAt: now,
  }));
}

export async function parseMemberFile(file: File): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsv(await file.text());
  }
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];
}

function parseCsv(text: string) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
