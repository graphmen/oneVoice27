"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import {
  DUTY_LABEL,
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
  const unassigned = unassignedMembers(members);
  const verse = verseOfTheDay();

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-cyan">Conference monitor</div>
          <h1 className="mt-1 text-3xl font-semibold">Shepherd performance</h1>
          <p className="mt-2 max-w-3xl text-white/65">
            Assess how pastors are covering their assigned flock in {state.settings.conferenceName}. Conference does not
            schedule visits — it watches duty, presence, and fruit, then manages the shepherds.
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Shepherds" value={rows.length} />
        <Stat label="Behind on duty" value={behind.length} warn={behind.length > 0} hint="Overdue flock or no field visits" />
        <Stat label="Needs watch" value={watch.length} hint="Some overdue, exceptions, or weak GPS proof" />
        <Stat label="Unassigned members" value={unassigned.length} warn={unassigned.length > 0} hint="No named shepherd" />
        <Stat label="Exceptions to review" value={pendingEx.length} warn={pendingEx.length > 0} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Flock coverage" value={`${coverage.percent}%`} hint={`${coverage.overdue} overdue souls`} warn={coverage.percent < 80} compact />
        <Stat label="GPS-verified visits" value={verified.length} hint={`${verifiedRate(visits)}% of field visits`} compact />
        <Stat label="Bible studies" value={fruit.bibleStudy} compact />
        <Stat label="Baptism interest" value={fruit.baptismInterest} compact />
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
                    {row.districtName} · {row.churchName} · {row.overdue} overdue of {row.assigned}
                    {row.crisisOverdue ? ` · ${row.crisisOverdue} new/crisis overdue` : ""}
                    {row.pendingExceptions ? ` · ${row.pendingExceptions} exception` : ""}
                    {row.fieldVisits === 0 ? " · no field visits recorded" : ` · last field visit ${formatDate(row.lastVisitAt)}`}
                  </div>
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

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="glass overflow-x-auto rounded-lg p-5">
          <h2 className="text-lg font-semibold">Duty assessment</h2>
          <p className="mt-1 text-sm text-white/50">
            Behind = overdue flock or no GPS-proven visits. Watch = exceptions or weak verification. Training is not
            counted as duty.
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-widest text-white/45">
              <tr>
                <th className="pb-3">Shepherd</th>
                <th>Duty</th>
                <th>District</th>
                <th>Assigned</th>
                <th>Overdue</th>
                <th>Coverage</th>
                <th>Verified</th>
                <th>Last field visit</th>
                <th>Fruit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.pastor.id} className="border-t border-white/8">
                  <td className="py-3">
                    <div>{row.pastor.displayName}</div>
                    <div className="text-xs text-white/45">{row.churchName}</div>
                  </td>
                  <td>
                    <StatusBadge status={row.duty} />
                    <span className="sr-only">{DUTY_LABEL[row.duty]}</span>
                  </td>
                  <td className="text-white/60">{row.districtName}</td>
                  <td>{row.assigned}</td>
                  <td className={row.overdue ? "text-rose" : ""}>{row.overdue}</td>
                  <td className={row.coverage < 70 ? "text-rose" : ""}>{row.coverage}%</td>
                  <td>
                    {row.verified}/{row.fieldVisits}
                    {row.fieldVisits ? ` · ${row.verifiedPct}%` : ""}
                  </td>
                  <td className="text-white/60">{formatDate(row.lastVisitAt)}</td>
                  <td className="text-white/60">
                    {row.bibleStudy} studies · {row.baptismInterest} baptism
                  </td>
                  <td className="text-right">
                    <Link href={`/members?pastor=${row.pastor.id}`} className="text-cyan">
                      Flock
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <article className="glass overflow-hidden rounded-lg">
          <div className="h-28 bg-cover bg-center" style={{ backgroundImage: `url(${verse.image})` }} />
          <div className="p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-gold">Word for officers</div>
            <p className="mt-2 font-serif leading-snug">“{verse.text}”</p>
            <div className="mt-2 text-sm text-cyan">{verse.reference}</div>
            {pendingEx.length > 0 && (
              <Link href="/exceptions" className="btn btn-ghost mt-4 w-full py-2 text-xs">
                Review {pendingEx.length} exception{pendingEx.length === 1 ? "" : "s"}
              </Link>
            )}
          </div>
        </article>
      </div>
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
