import type { Church, Member, Territory, UserAccount, Visit } from "./types";
import { isOverdue } from "./utils";

export function isCompletedCare(visit: Visit) {
  return visit.status === "completed" || visit.status === "exception_approved";
}

export function isFieldVisit(visit: Visit) {
  return !visit.trainingOverride;
}

export function fieldCareVisits(visits: Visit[]) {
  return visits.filter((v) => isCompletedCare(v) && isFieldVisit(v));
}

export function verifiedFieldVisits(visits: Visit[]) {
  return fieldCareVisits(visits).filter((v) => v.locationVerification === "verified");
}

export function flockCoverage(members: Member[]) {
  const active = members.filter((m) => m.status === "active");
  const overdue = active.filter((m) => isOverdue(m));
  const current = active.length - overdue.length;
  return {
    active: active.length,
    current,
    overdue: overdue.length,
    percent: active.length ? Math.round((current / active.length) * 100) : 100,
  };
}

export function fruitCounts(visits: Visit[]) {
  const field = fieldCareVisits(visits);
  return {
    prayed: field.filter((v) => v.prayed).length,
    bibleStudy: field.filter((v) => v.bibleStudy).length,
    baptismInterest: field.filter((v) => v.baptismInterest).length,
    decisionMade: field.filter((v) => v.decisionMade).length,
    referred: field.filter((v) => v.referred).length,
  };
}

export function verifiedRate(visits: Visit[]) {
  const field = fieldCareVisits(visits);
  const verified = verifiedFieldVisits(visits).length;
  return field.length ? Math.round((verified / field.length) * 100) : 0;
}

export function fruitLabel(visit: Visit) {
  const bits: string[] = [];
  if (visit.prayed) bits.push("Prayed");
  if (visit.bibleStudy) bits.push("Bible study");
  if (visit.baptismInterest) bits.push("Baptism interest");
  if (visit.decisionMade) bits.push("Decision");
  if (visit.referred) bits.push("Referred");
  return bits.join(" · ") || "—";
}

export function shepherdMonitorRows(
  user: UserAccount,
  members: Member[],
  visits: Visit[],
  churches: Church[],
  territories: Territory[],
  users: UserAccount[],
) {
  return users
    .filter((u) => u.role === "pastor" && u.status === "active")
    .filter((p) => user.role === "master_admin" || user.churchIds.some((id) => p.churchIds.includes(id)))
    .map((p) => {
      const assigned = members.filter((m) => m.assignedPastorId === p.id && m.status === "active");
      const overdue = assigned.filter((m) => isOverdue(m));
      const pastorVisits = visits.filter((v) => v.pastorId === p.id);
      const field = fieldCareVisits(pastorVisits);
      const verified = verifiedFieldVisits(pastorVisits);
      const fruit = fruitCounts(pastorVisits);
      const pendingExceptions = pastorVisits.filter((v) => v.status === "exception_pending").length;
      const trainingCount = pastorVisits.filter((v) => v.trainingOverride && isCompletedCare(v)).length;
      const lastVisitAt = field
        .map((v) => v.completedAt)
        .filter(Boolean)
        .sort()
        .at(-1);
      const church = churches.find((c) => p.churchIds.includes(c.id));
      const district = territories.find((t) => t.id === church?.districtId);
      const coverage = flockCoverage(assigned).percent;
      const verifiedPct = field.length ? Math.round((verified.length / field.length) * 100) : 0;
      const crisisOverdue = overdue.filter((m) => m.memberType === "crisis" || m.memberType === "new").length;
      const metrics = {
        assigned: assigned.length,
        overdue: overdue.length,
        coverage,
        fieldVisits: field.length,
        verifiedPct,
        pendingExceptions,
      };
      const duty = dutyStatus(metrics);
      return {
        pastor: p,
        assigned: assigned.length,
        overdue: overdue.length,
        crisisOverdue,
        fieldVisits: field.length,
        verified: verified.length,
        verifiedPct,
        coverage,
        prayed: fruit.prayed,
        bibleStudy: fruit.bibleStudy,
        baptismInterest: fruit.baptismInterest,
        decisionMade: fruit.decisionMade,
        pendingExceptions,
        trainingCount,
        lastVisitAt,
        districtName: district?.name || "—",
        churchName: church?.name || "—",
        duty,
        reason: dutyReason(metrics, duty),
      };
    })
    .sort((a, b) => dutyRank(a.duty) - dutyRank(b.duty) || b.overdue - a.overdue);
}

export type DutyStatus = "behind" | "watch" | "idle" | "current";

function dutyRank(duty: DutyStatus) {
  return { behind: 0, watch: 1, idle: 2, current: 3 }[duty];
}

export const DUTY_LABEL: Record<DutyStatus, string> = {
  behind: "Behind",
  watch: "Watch",
  idle: "No flock",
  current: "Current",
};

export const DUTY_HINT: Record<DutyStatus, string> = {
  behind: "Three or more households overdue, coverage under 70%, or no GPS field visit yet.",
  watch: "Some overdue care, a pending exception, or fewer than 60% of field visits GPS-verified.",
  idle: "No members assigned. Conference must place a flock on this shepherd.",
  current: "Assigned flock is current. Field visits are GPS-verified. No pending exceptions.",
};

type DutyMetrics = {
  assigned: number;
  overdue: number;
  coverage: number;
  fieldVisits: number;
  verifiedPct: number;
  pendingExceptions: number;
};

function dutyStatus(row: DutyMetrics): DutyStatus {
  if (row.assigned === 0) return "idle";
  if (row.overdue >= 3 || row.coverage < 70 || (row.assigned > 0 && row.fieldVisits === 0)) return "behind";
  if (row.overdue > 0 || row.pendingExceptions > 0 || (row.fieldVisits > 0 && row.verifiedPct < 60)) return "watch";
  return "current";
}

export function dutyReason(row: DutyMetrics, duty = dutyStatus(row)) {
  if (duty === "idle") return "No members assigned";
  if (duty === "behind") {
    if (row.fieldVisits === 0) return "No GPS field visits recorded";
    if (row.overdue >= 3) return `${row.overdue} households overdue`;
    if (row.coverage < 70) return `Only ${row.coverage}% of the flock is current`;
  }
  if (duty === "watch") {
    if (row.pendingExceptions > 0) {
      return `${row.pendingExceptions} visit exception${row.pendingExceptions === 1 ? "" : "s"} awaiting review`;
    }
    if (row.fieldVisits > 0 && row.verifiedPct < 60) return `Only ${row.verifiedPct}% of visits GPS-verified`;
    if (row.overdue > 0) return `${row.overdue} household${row.overdue === 1 ? "" : "s"} still overdue`;
  }
  return "Flock current · GPS-verified presence";
}

export type VisitGrade = "strong" | "sound" | "weak" | "exception" | "training" | "scheduled";

export function visitGrade(visit: Visit): VisitGrade {
  if (visit.status === "scheduled") return "scheduled";
  if (visit.trainingOverride) return "training";
  if (visit.status === "exception_pending" || visit.status === "exception_rejected") return "exception";
  const completed = isCompletedCare(visit);
  const verified = visit.locationVerification === "verified";
  const fruit = Boolean(visit.prayed || visit.bibleStudy || visit.baptismInterest || visit.decisionMade);
  if (completed && verified && fruit) return "strong";
  if (completed && verified) return "sound";
  return "weak";
}

export const VISIT_GRADE_LABEL: Record<VisitGrade, string> = {
  strong: "Strong",
  sound: "Sound",
  weak: "Weak",
  exception: "Exception",
  training: "Training",
  scheduled: "Booked",
};

export const VISIT_GRADE_HINT: Record<VisitGrade, string> = {
  strong: "GPS verified, with prayer, study, or baptism fruit",
  sound: "GPS verified, no fruit recorded",
  weak: "Completed without GPS proof",
  exception: "Needs review or was rejected",
  training: "Training — not a field GPS lock",
  scheduled: "Date booked — visit not yet confirmed at the home",
};

export function unassignedMembers(members: Member[]) {
  return members.filter((m) => m.status === "active" && !m.assignedPastorId);
}
