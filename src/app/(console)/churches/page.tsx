"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconSearch } from "@/components/icons";
import { useStore } from "@/lib/store";
import { ancestors } from "@/lib/gis";
import { canEditGis, canManageChurch } from "@/lib/utils";

export default function ChurchesPage() {
  const { user, state } = useStore();
  const [q, setQ] = useState("");
  const churches = useMemo(() => {
    if (!user) return [];
    return user.role === "master_admin"
      ? state.churches
      : state.churches.filter((c) => user.churchIds.includes(c.id));
  }, [user, state.churches]);
  const listed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return churches
      .filter((c) => {
        if (!needle) return true;
        const district = state.territories.find((t) => t.id === c.districtId);
        return `${c.name} ${c.city} ${c.address} ${district?.name || ""}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [churches, q, state.territories]);
  const fieldGps = churches.filter((c) => c.source === "field_gps").length;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Churches</h1>
          <p className="mt-2 text-white/60">
            {churches.length} congregations on the books
            {fieldGps ? ` · ${fieldGps} pinned from the EZC field GPS list` : ""}. Open Edit to change the pin or
            details.
          </p>
        </div>
        {canEditGis(user) && (
          <Link href="/territories?type=church" className="btn btn-primary">
            Register a church
          </Link>
        )}
      </div>
      <label className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <IconSearch size={16} />
        <input
          type="search"
          placeholder="Search church, district or city"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <div className="mt-5 grid gap-1">
        {listed.length === 0 && <p className="text-sm text-white/55">No congregation matches that search.</p>}
        {listed.map((c) => {
          const count = state.members.filter((m) => m.churchId === c.id).length;
          const pastors = state.users.filter((u) => u.role === "pastor" && u.churchIds.includes(c.id)).length;
          const district = state.territories.find((t) => t.id === c.districtId);
          const path = district ? ancestors(state.territories, district.id) : [];
          return (
            <div key={c.id} className="list-row">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="list-row-title">{c.name}</div>
                  {c.source === "field_gps" ? (
                    <span className="badge bg-cyan/15 text-cyan">Field GPS</span>
                  ) : c.source === "demo" ? (
                    <span className="badge bg-white/10 text-white/70">Demo flock</span>
                  ) : null}
                </div>
                <div className="list-row-meta whitespace-normal">
                  {c.city}
                  {c.address && c.address !== "Field GPS pin" ? ` · ${c.address}` : ""} · {count} members · {pastors}{" "}
                  shepherds
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
