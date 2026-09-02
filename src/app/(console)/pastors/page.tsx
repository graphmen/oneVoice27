"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { LEVEL_LABEL } from "@/lib/gis";
import { canEditGis, ROLE_LABEL } from "@/lib/utils";

export default function PastorsPage() {
  const { user, state } = useStore();
  if (!user) return null;
  const shepherds = state.users.filter((u) => {
    if (u.role === "master_admin") return false;
    if (user.role === "master_admin") return true;
    return u.churchIds.some((id) => user.churchIds.includes(id));
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Shepherds</h1>
          <p className="mt-2 text-white/60">
            Pastors already assigned to a district or church. New shepherds are registered from the Register desk.
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
          return (
            <div key={p.id} className="list-row">
              <div className="min-w-0 flex-1">
                <div className="list-row-title">{p.displayName}</div>
                <div className="list-row-meta">
                  {ROLE_LABEL[p.role]} · {p.email} · {p.phone} · {assigned} assigned
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
