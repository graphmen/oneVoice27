"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MemberActions } from "@/components/MemberActions";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import {
  canDeleteMember,
  dueLabel,
  formatDate,
  formatDateTime,
  FREQUENCY_LABEL,
  fullName,
  isOverdue,
  memberPriority,
  readyPastoralMessage,
} from "@/lib/utils";

const LeafletTerritoryMap = dynamic(() => import("@/components/gis/LeafletTerritoryMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-white/50">Loading home map…</div>,
});

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, user, deleteMember } = useStore();
  const member = state.members.find((m) => m.id === id);
  if (!user || !member) return <p>Member not found.</p>;

  const church = state.churches.find((c) => c.id === member.churchId);
  const pastor = state.users.find((u) => u.id === member.assignedPastorId);
  const history = state.visits.filter((v) => v.memberId === member.id);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">
            {user.role === "pastor" ? "Member profile" : "Flock record"}
          </div>
          <h1 className="text-3xl font-semibold">{fullName(member)}</h1>
          <p className="text-white/60">{member.address}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/members" className="btn btn-ghost">
            Back to members
          </Link>
          <MemberActions member={member} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge status={member.memberType} />
        <StatusBadge status={memberPriority(member)} />
        <StatusBadge status={isOverdue(member) ? "overdue" : "due"} />
        <span className="text-sm text-white/60">{dueLabel(member)}</span>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="glass rounded-lg p-5 text-sm">
          <Row k="Church" v={church?.name} />
          <Row k="Assigned pastor" v={pastor?.displayName || "Unassigned"} />
          <Row k="Phone" v={member.phone} />
          <Row k="Email" v={member.email} />
          <Row k="Frequency" v={FREQUENCY_LABEL[member.visitationFrequency]} />
          <Row k="Last visit" v={formatDate(member.lastVisitAt)} />
          <Row k="Next due" v={formatDate(member.nextVisitDue)} />
          <Row k="Geofence" v={`${member.geofenceRadius} m`} />
          <Row k="Coordinates" v={`${member.lat.toFixed(5)}, ${member.lng.toFixed(5)}`} />
          {member.adminNotes && <Row k="Admin notes" v={member.adminNotes} />}
        </div>
        <div className="h-[min(42vh,calc(100dvh-16rem))] min-h-[220px] overflow-hidden rounded-lg border border-white/10 sm:h-[min(68vh,calc(100dvh-14rem))] sm:min-h-[420px]">
          <LeafletTerritoryMap
            territories={state.territories}
            churches={state.churches}
            mode="browse"
            pin={{ lat: member.lat, lng: member.lng }}
            pinRadius={member.geofenceRadius}
            pinLabel={`${fullName(member)} · home`}
            flyTo={{ lat: member.lat, lng: member.lng, zoom: 16 }}
            compactControl
            className="h-full w-full"
          />
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {user.role === "pastor" ? (
          <div className="glass rounded-lg p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-cyan">Ready pastoral message</div>
            <p className="mt-2 text-white/80">
              “{readyPastoralMessage(member.firstName, church?.name || "the church")}”
            </p>
            <p className="mt-2 text-sm text-white/50">
              Call and WhatsApp above send this text. Edit the record if the family moved or the details are wrong.
            </p>
          </div>
        ) : (
          <div className="glass rounded-lg p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-cyan">Conference record</div>
            <p className="mt-2 text-white/80">
              Assigned to {pastor?.displayName || "no shepherd yet"}. Conference does not call, message, or visit this
              household. Use Edit record if the shepherd, address, or membership details are wrong.
            </p>
          </div>
        )}
        <div className="glass rounded-lg p-5">
          <h2 className="text-lg font-semibold">Visitation history</h2>
          <div className="mt-3 grid gap-2">
            {history.length === 0 && <p className="text-white/60">No visits recorded yet.</p>}
            {history.map((v) => (
              <Link key={v.id} href={`/visits/${v.id}`} className="flex justify-between rounded-lg bg-white/5 px-4 py-3">
                <span>{formatDateTime(v.completedAt || v.createdAt)}</span>
                <span className="flex gap-2">
                  <StatusBadge status={v.status} />
                  <StatusBadge status={v.locationVerification} />
                  {v.trainingOverride && <StatusBadge status="training" />}
                  {v.durationMinutes ? <span className="text-xs text-white/50">{v.durationMinutes} min</span> : null}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      {user && canDeleteMember(user, member) && (
        <div className="mt-6">
          <ConfirmDelete
            noun="member"
            name={fullName(member)}
            warning={
              history.length
                ? `This also removes ${history.length} visit record${history.length === 1 ? "" : "s"} for this household.`
                : "This household will leave the flock list."
            }
            onConfirm={() => {
              deleteMember(member.id);
              router.push("/members");
            }}
          />
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/8 py-2">
      <span className="text-white/50">{k}</span>
      <span className="text-right">{v || "—"}</span>
    </div>
  );
}
