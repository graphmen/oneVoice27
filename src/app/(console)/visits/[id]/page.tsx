"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import { fruitLabel, visitGrade } from "@/lib/care";
import { canSeeConfidential, formatDateTime, fullName } from "@/lib/utils";

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, state } = useStore();
  const visit = state.visits.find((v) => v.id === id);
  if (!user || !visit) return <p>Visit not found.</p>;
  const member = state.members.find((m) => m.id === visit.memberId);
  const pastor = state.users.find((u) => u.id === visit.pastorId);
  const church = state.churches.find((c) => c.id === visit.churchId);
  const category = state.categories.find((c) => c.id === visit.categoryId);
  const showConfidential = canSeeConfidential(user, visit);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan">Visit {visit.id}</div>
      <h1 className="mt-2 text-3xl font-semibold">{member ? fullName(member) : "Member"}</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge status={visitGrade(visit)} />
        <StatusBadge status={visit.status} />
        <StatusBadge status={visit.locationVerification} />
        <StatusBadge status={visit.geofenceStatus} />
        {visit.trainingOverride && <StatusBadge status="training" />}
      </div>
      <div className="glass mt-6 rounded-lg p-6 text-sm">
        <Row k="Pastor" v={pastor?.displayName} />
        <Row k="District" v={state.territories.find((t) => t.id === church?.districtId)?.name} />
        <Row k="Church" v={church?.name} />
        <Row k="Visit type" v={category?.name} />
        <Row k="Booked for" v={formatDateTime(visit.scheduledAt)} />
        <Row k="Grade" v={`${visitGrade(visit)} — ${fruitLabel(visit) === "—" ? "no fruit recorded" : fruitLabel(visit)}`} />
        <Row k="Completed" v={formatDateTime(visit.completedAt)} />
        <Row k="Geofence entered" v={formatDateTime(visit.geofenceEnteredAt)} />
        <Row k="GPS" v={visit.lat ? `${visit.lat.toFixed(5)}, ${visit.lng?.toFixed(5)} ±${Math.round(visit.accuracy || 0)}m` : "Not recorded"} />
        <Row k="Duration" v={visit.durationMinutes ? `${visit.durationMinutes} min` : "—"} />
        <Row k="Admin record" v={visit.adminNotes} />
        {showConfidential ? (
          <Row k="Confidential notes" v={visit.confidentialNotes} />
        ) : (
          <Row k="Confidential notes" v={visit.confidentialNotes ? "Restricted to pastoral personnel" : "—"} />
        )}
        <Row k="Prayer request" v={visit.prayerRequest} />
        <Row k="Soul-winning fruit" v={fruitLabel(visit)} />
        <Row k="Follow-up" v={visit.followUpRequired ? (visit.followUpAt ? `Required · ${visit.followUpAt}` : "Required") : "No"} />
        {visit.exceptionReason && <Row k="Exception reason" v={visit.exceptionReason} />}
        {visit.trainingOverride && <Row k="Training override" v="Yes — not a field GPS lock" />}
      </div>
      {member && (
        <Link href={`/members/${member.id}`} className="btn btn-ghost mt-4">
          Open member profile
        </Link>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="border-b border-white/8 py-3">
      <div className="text-white/45">{k}</div>
      <div className="mt-1 whitespace-pre-wrap">{v || "—"}</div>
    </div>
  );
}
