"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { EvaluationLegend, ShepherdPerformanceMatrix } from "@/components/ShepherdMatrix";
import { useStore } from "@/lib/store";
import {
  flockCoverage,
  fruitCounts,
  shepherdMonitorRows,
  unassignedMembers,
  verifiedFieldVisits,
  verifiedRate,
} from "@/lib/care";
import {
  dueLabel,
  formatDate,
  fullName,
  isDueSoon,
  isOverdue,
  memberPriority,
  visibleMembers,
  visibleVisits,
} from "@/lib/utils";
import { verseOfTheDay } from "@/lib/verses";
import type { Member } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useStore();
  if (!user) return null;
  return user.role === "pastor" ? <PastorHome /> : <ConferenceMonitor />;
}

function PastorHome() {
  const { user, state } = useStore();
  if (!user) return null;
  const members = visibleMembers(user, state.members).filter((m) => m.status === "active");
  const overdue = members.filter((m) => isOverdue(m));
  const dueSoon = members.filter((m) => !isOverdue(m) && isDueSoon(m));
  const extraCare = members.filter(
    (m) =>
      (m.memberType === "new" || m.memberType === "crisis" || m.memberType === "followup") &&
      !overdue.some((x) => x.id === m.id) &&
      !dueSoon.some((x) => x.id === m.id),
  );
  const first = overdue[0] || dueSoon[0] || extraCare[0] || members[0];
  const churchName = (id: string) => state.churches.find((c) => c.id === id)?.name || "Church";

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-cyan">Pastor field</div>
          <h1 className="mt-1 text-3xl font-semibold">Peace, {user.displayName.split(" ")[0]}.</h1>
          <p className="mt-2 max-w-2xl text-white/65">
            Visit those who need care most. Confirm only when you are at the home. After the visit, record the
            spiritual fruit.
          </p>
        </div>
        {first ? (
          <Link href={`/go/${first.id}`} className="btn btn-primary">
            Visit {fullName(first).split(" ")[0]}
          </Link>
        ) : (
          <Link href="/schedule" className="btn btn-primary">
            Open schedule
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Assigned flock" value={members.length} />
        <Stat label="Overdue" value={overdue.length} warn={overdue.length > 0} />
        <Stat label="Due this week" value={dueSoon.length} />
        <Stat label="New / crisis / follow-up" value={members.filter((m) => ["new", "crisis", "followup"].includes(m.memberType)).length} />
      </div>

      <Queue title="Overdue — go today" items={overdue} churchName={churchName} empty="No overdue visits. The flock is current." />
      <Queue title="Due this week" items={dueSoon} churchName={churchName} empty="Nothing due in the next seven days." />
      <Queue title="New, crisis and follow-up" items={extraCare} churchName={churchName} empty="No extra-care members waiting outside the due list." />
    </div>
  );
}

function ConferenceMonitor() {
  const { user, state } = useStore();
  if (!user) return null;
  const members = visibleMembers(user, state.members).filter((m) => m.status === "active");
  const visits = visibleVisits(user, state.visits, state.members);
  const verified = verifiedFieldVisits(visits);
  const coverage = flockCoverage(members);
  const fruit = fruitCounts(visits);
  const pendingEx = visits.filter((v) => v.status === "exception_pending");
  const rows = shepherdMonitorRows(user, members, visits, state.churches, state.territories, state.users);
  const behind = rows.filter((r) => r.duty === "behind");
  const watch = rows.filter((r) => r.duty === "watch");
  const current = rows.filter((r) => r.duty === "current");
  const idle = rows.filter((r) => r.duty === "idle");
  const unassigned = unassignedMembers(members);
  const verse = verseOfTheDay();

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-cyan">Conference monitor</div>
          <h1 className="mt-1 text-3xl font-semibold">Monitoring & evaluation</h1>
          <p className="mt-2 max-w-3xl text-white/65">
            Conference does not visit members. It rates each shepherd on three questions: is the assigned flock current
            (coverage), was the pastor physically at the home (GPS presence), and did the visit record spiritual fruit?
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/territories?type=shepherd" className="btn btn-ghost">
            Register a shepherd
          </Link>
          <Link href="/pastors" className="btn btn-cyan">
            Manage shepherds
          </Link>
        </div>
      </div>

      <EvaluationLegend />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Shepherds" value={rows.length} />
        <Stat label="Behind" value={behind.length} warn={behind.length > 0} hint="Need conference action" />
        <Stat label="Watch" value={watch.length} hint="Keep under review" />
        <Stat label="Current" value={current.length} hint="Flock current · GPS proof" />
        <Stat label="No flock" value={idle.length} warn={idle.length > 0} hint="Assign members to these shepherds" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Flock coverage" value={`${coverage.percent}%`} hint={`${coverage.overdue} overdue souls`} warn={coverage.percent < 80} compact />
        <Stat label="GPS-verified visits" value={verified.length} hint={`${verifiedRate(visits)}% of field visits`} compact />
        <Stat label="Bible studies" value={fruit.bibleStudy} compact />
        <Stat label="Baptism interest" value={fruit.baptismInterest} compact />
        <Stat label="Unassigned members" value={unassigned.length} warn={unassigned.length > 0} hint="No named shepherd" compact />
      </div>

      {(behind.length > 0 || watch.length > 0) && (
        <div className="glass mt-6 rounded-lg p-5">
          <h2 className="text-lg font-semibold">Attention — shepherds to manage</h2>
          <p className="mt-1 text-sm text-white/50">
            Open the flock to reassign members. Review exceptions. Conference does not schedule the visit for them.
          </p>
          <div className="mt-4 grid gap-2">
            {[...behind, ...watch].map((row) => (
              <div key={row.pastor.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/5 px-4 py-3">
                <div>
                  <div className="font-medium">{row.pastor.displayName}</div>
                  <div className="text-xs text-white/55">
                    {row.districtName} · {row.churchName}
                    {row.crisisOverdue ? ` · ${row.crisisOverdue} new/crisis overdue` : ""}
                    {row.lastVisitAt ? ` · last field visit ${formatDate(row.lastVisitAt)}` : ""}
                  </div>
                  <div className="mt-1 text-sm text-white/75">{row.reason}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={row.duty} />
                  <Link href={`/members?pastor=${row.pastor.id}`} className="btn btn-ghost">
                    See flock
                  </Link>
                  {row.pendingExceptions > 0 && (
                    <Link href="/exceptions" className="btn btn-cyan">
                      Exceptions
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="glass mt-6 rounded-lg p-5">
          <h2 className="text-lg font-semibold">Members with no shepherd</h2>
          <p className="mt-1 text-sm text-white/50">Assign a pastor on the member edit screen. Unassigned souls cannot be visited.</p>
          <div className="mt-3 grid gap-2">
            {unassigned.slice(0, 8).map((m) => (
              <Link key={m.id} href={`/members/${m.id}/edit`} className="flex justify-between rounded-lg bg-white/5 px-4 py-3 text-sm">
                <span>{fullName(m)}</span>
                <span className="text-gold">Assign shepherd</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="glass mt-6 rounded-lg p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Pastor performance matrix</h2>
        <p className="mt-1 text-sm text-white/50">
          Sorted Behind first, then Watch, No flock, Current. Training visits are excluded from GPS proof and fruit. Open
          Flock to reassign members — conference does not schedule the visit.
        </p>
        <ShepherdPerformanceMatrix rows={rows} />
      </div>

      <article className="glass mt-6 overflow-hidden rounded-lg sm:flex">
        <div className="h-28 shrink-0 bg-cover bg-center sm:h-auto sm:w-56" style={{ backgroundImage: `url(${verse.image})` }} />
        <div className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-gold">Word for officers</div>
          <p className="mt-2 font-serif leading-snug">“{verse.text}”</p>
          <div className="mt-2 text-sm text-cyan">{verse.reference}</div>
          {pendingEx.length > 0 && (
            <Link href="/exceptions" className="btn btn-ghost mt-4 py-2 text-xs">
              Review {pendingEx.length} exception{pendingEx.length === 1 ? "" : "s"}
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}

function Queue({
  title,
  items,
  churchName,
  empty,
}: {
  title: string;
  items: Member[];
  churchName: (id: string) => string;
  empty: string;
}) {
  return (
    <div className="glass mt-6 rounded-lg p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 grid gap-2">
        {items.length === 0 && <p className="text-sm text-white/60">{empty}</p>}
        {items.map((m) => (
          <div key={m.id} className="list-row">
            <div className="min-w-0 flex-1">
              <div className="list-row-title">{fullName(m)}</div>
              <div className="list-row-meta">
                {churchName(m.churchId)} · {m.suburb || m.address}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <StatusBadge status={m.memberType} />
              <StatusBadge status={memberPriority(m)} />
              <StatusBadge status={isOverdue(m) ? "overdue" : "due"} />
              <span className="text-xs text-white/50">{dueLabel(m)}</span>
              <Link href={`/go/${m.id}`} className="btn btn-primary">
                Visit
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  warn,
  compact,
}: {
  label: string;
  value: string | number;
  hint?: string;
  warn?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="glass rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">{label}</div>
      <div className={`mt-1 font-semibold ${compact ? "text-xl" : "text-3xl"} ${warn ? "text-rose" : ""}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-white/50">{hint}</div>}
    </div>
  );
}
