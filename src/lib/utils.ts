import type { Member, Priority, UserAccount, Visit, VisitFrequency } from "./types";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function fullName(member: Pick<Member, "firstName" | "lastName">) {
  return `${member.firstName} ${member.lastName}`.trim();
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysBetween(fromIso: string, to = new Date()) {
  const from = new Date(fromIso);
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function frequencyDays(freq: VisitFrequency, custom?: number) {
  switch (freq) {
    case "monthly":
      return 30;
    case "bimonthly":
      return 60;
    case "quarterly":
      return 90;
    case "biannually":
      return 182;
    case "annually":
      return 365;
    case "custom":
      return custom || 30;
  }
}

export function computeNextDue(lastVisitAt: string | undefined, freq: VisitFrequency, custom?: number) {
  const base = lastVisitAt ?? new Date().toISOString();
  return addDays(base, frequencyDays(freq, custom));
}

function clock(now?: Date | number) {
  return now instanceof Date ? now : new Date();
}

export function memberPriority(member: Member, now?: Date): Priority {
  const current = clock(now);
  if (member.memberType === "crisis" || member.memberType === "new" || member.memberType === "followup") {
    return "high";
  }
  const due = new Date(member.nextVisitDue);
  const delta = Math.floor((due.getTime() - current.getTime()) / 86_400_000);
  if (delta < -14) return "high";
  if (delta <= 7) return "medium";
  return "normal";
}

export function dueLabel(member: Member, now?: Date) {
  const current = clock(now);
  const delta = Math.floor((new Date(member.nextVisitDue).getTime() - current.getTime()) / 86_400_000);
  if (delta < 0) return `${Math.abs(delta)}d overdue`;
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  return `Due in ${delta}d`;
}

export function isOverdue(member: Member, now?: Date) {
  const current = clock(now);
  return new Date(member.nextVisitDue).getTime() < current.getTime() - 86_400_000;
}

export function isDueSoon(member: Member, now?: Date, withinDays = 7) {
  const current = clock(now);
  const t = new Date(member.nextVisitDue).getTime();
  const n = current.getTime();
  return t >= n - 86_400_000 && t <= n + withinDays * 86_400_000;
}

export function canSeeChurch(user: UserAccount, churchId: string) {
  if (user.role === "master_admin") return true;
  return user.churchIds.includes(churchId);
}

export function canManageMembers(user: UserAccount) {
  return user.role === "master_admin" || user.role === "church_admin";
}

export function canRegisterMembers(user: UserAccount) {
  return user.role === "master_admin" || user.role === "church_admin" || user.role === "pastor";
}

export function canAssignPastor(user: UserAccount) {
  return user.role === "master_admin" || user.role === "church_admin";
}

export function canEditGis(user: UserAccount) {
  return user.role === "master_admin" || user.role === "church_admin";
}

export function canEditMember(user: UserAccount, member: Member) {
  if (user.role === "master_admin") return true;
  if (user.role === "church_admin") return user.churchIds.includes(member.churchId);
  return member.assignedPastorId === user.id;
}

export function readyPastoralMessage(firstName: string, churchName: string) {
  return `Peace ${firstName}, this is your pastor from ${churchName}. I would like to visit and pray with you.`;
}

export function readyVisitMessage(firstName: string) {
  return `Peace ${firstName}, I am on my way for our pastoral visit.`;
}

export function canApproveExceptions(user: UserAccount) {
  return user.role === "master_admin" || user.role === "church_admin";
}

export function visibleMembers(user: UserAccount, members: Member[]) {
  if (user.role === "master_admin") return members;
  if (user.role === "church_admin") {
    return members.filter((m) => user.churchIds.includes(m.churchId));
  }
  return members.filter((m) => m.assignedPastorId === user.id);
}

export function visibleVisits(user: UserAccount, visits: Visit[], members: Member[]) {
  const memberIds = new Set(visibleMembers(user, members).map((m) => m.id));
  if (user.role === "pastor") return visits.filter((v) => v.pastorId === user.id);
  return visits.filter((v) => memberIds.has(v.memberId) || user.churchIds.includes(v.churchId) || user.role === "master_admin");
}

export function canSeeConfidential(user: UserAccount, visit: Visit) {
  return user.role === "master_admin" || visit.pastorId === user.id;
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function telHref(phone?: string) {
  if (!phone) return undefined;
  const n = phone.replace(/[^\d+]/g, "");
  return n ? `tel:${n}` : undefined;
}

export function waHref(phone?: string, text?: string) {
  if (!phone) return undefined;
  const n = phone.replace(/[^\d]/g, "");
  if (!n) return undefined;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${n}${q}`;
}

export function mapsUrl(lat: number, lng: number, label?: string) {
  const dest = `${lat},${lng}`;
  const q = label ? encodeURIComponent(label) : dest;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&destination_place_id=&travelmode=driving&q=${q}`;
}

export function osmEmbed(lat: number, lng: number, delta = 0.01) {
  const minLon = lng - delta;
  const minLat = lat - delta;
  const maxLon = lng + delta;
  const maxLat = lat + delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export const FREQUENCY_LABEL: Record<VisitFrequency, string> = {
  monthly: "Monthly",
  bimonthly: "Every 2 months",
  quarterly: "Quarterly",
  biannually: "Biannually",
  annually: "Annually",
  custom: "Custom",
};

export const ROLE_LABEL: Record<UserAccount["role"], string> = {
  master_admin: "Master Administrator",
  church_admin: "Church Administrator",
  pastor: "Pastor",
};
