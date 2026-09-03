"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { shepherdMonitorRows } from "@/lib/care";
import { useStore } from "@/lib/store";
import { LEVEL_LABEL } from "@/lib/gis";
import { canEditGis, canManageAccount, ROLE_LABEL, visibleMembers, visibleVisits } from "@/lib/utils";

export default function PastorsPage() {
  const { user, state } = useStore();
  if (!user) return null;
  const shepherds = state.users.filter((u) => {
    if (u.role === "master_admin") return false;
    if (user.role === "master_admin") return true;
    return u.churchIds.some((id) => user.churchIds.includes(id));
  });
  const performance = Object.fromEntries(
    shepherdMonitorRows(
      user,
      visibleMembers(user, state.members),
      visibleVisits(user, state.visits, state.members),
      state.churches,
      state.territories,
      state.users,
    ).map((row) => [row.pastor.id, row]),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Shepherds</h1>
          <p className="mt-2 text-white/60">
            Pastors and church officers already assigned. Ratings use the same conference matrix as Monitor and Reports.
            Open Edit to update details, placement, or remove an account.
          </p>
        </div>
        {canEditGis(user) && (
          <Link href="/territories?type=shepherd" className="btn btn-primary">
            Register a shepherd
          </Link>
        )}
      </div>
      <div className="mt-5 grid gap-1">
        {shepherds.map((p) => {
          const assigned = state.members.filter((m) => m.assignedPastorId === p.id).length;
          const territories = state.territories.filter(
            (t) => p.territoryIds?.includes(t.id) || t.assignedPastorIds.includes(p.id),
          );
          const row = performance[p.id];
          return (
            <div key={p.id} className="list-row">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="list-row-title">{p.displayName}</div>
                  {row && <StatusBadge status={row.duty} />}
                </div>
                <div className="list-row-meta">
                  {ROLE_LABEL[p.role]} · {p.status === "inactive" ? "Inactive · " : ""}
                  {p.email} · {p.phone} · {assigned} assigned
                  {row ? ` · ${row.coverage}% coverage · ${row.reason}` : ""}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {territories.map((t) => (
                    <span key={t.id} className="badge bg-cyan/15 text-cyan">
                      {LEVEL_LABEL[t.level]} · {t.shortName || t.name}
                    </span>
                  ))}
                  {territories.length === 0 && <span className="text-xs text-gold">No hierarchy placement yet</span>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {row && (
                  <Link href={`/members?pastor=${p.id}`} className="btn btn-ghost">
                    Flock
                  </Link>
                )}
                {canManageAccount(user, p) && (
                  <Link href={`/pastors/${p.id}/edit`} className="btn btn-ghost">
                    Edit
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
