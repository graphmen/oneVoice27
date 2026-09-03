"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { ancestors } from "@/lib/gis";
import { canEditGis, canManageChurch } from "@/lib/utils";

export default function ChurchesPage() {
  const { user, state } = useStore();
  if (!user) return null;
  const churches =
    user.role === "master_admin" ? state.churches : state.churches.filter((c) => user.churchIds.includes(c.id));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Churches</h1>
          <p className="mt-2 text-white/60">
            Congregations already on the books. Open Edit to change the pin or details, or to remove a congregation.
          </p>
        </div>
        {canEditGis(user) && (
          <Link href="/territories?type=church" className="btn btn-primary">
            Register a church
          </Link>
        )}
      </div>
      <div className="mt-5 grid gap-1">
        {churches.map((c) => {
          const count = state.members.filter((m) => m.churchId === c.id).length;
          const pastors = state.users.filter((u) => u.role === "pastor" && u.churchIds.includes(c.id)).length;
          const district = state.territories.find((t) => t.id === c.districtId);
          const path = district ? ancestors(state.territories, district.id) : [];
          return (
            <div key={c.id} className="list-row">
              <div className="min-w-0 flex-1">
                <div className="list-row-title">{c.name}</div>
                <div className="list-row-meta">
                  {c.address}, {c.city} · {count} members · {pastors} shepherds
                </div>
                <div className="mt-0.5 text-xs text-cyan">
                  {path.map((t) => t.shortName || t.name).join(" → ")}
                  {district ? ` → ${district.name}` : ""}
                </div>
              </div>
              {canManageChurch(user, c) && (
                <Link href={`/churches/${c.id}/edit`} className="btn btn-ghost">
                  Edit
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
