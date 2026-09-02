"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import { containingTerritories, LEVEL_LABEL } from "@/lib/gis";
import { dueLabel, fullName, isOverdue, memberPriority, visibleMembers } from "@/lib/utils";

const LeafletTerritoryMap = dynamic(() => import("@/components/gis/LeafletTerritoryMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-white/50">Loading care map…</div>,
});

export default function MapPage() {
  const { user, state } = useStore();
  const members = user ? visibleMembers(user, state.members).filter((m) => m.status === "active") : [];
  const [selected, setSelected] = useState(members[0]?.id);
  const [filter, setFilter] = useState("");
  const [listOpen, setListOpen] = useState(true);
  const member = members.find((m) => m.id === selected) || members[0];
  const flyTo = useMemo(
    () => (member ? { lat: member.lat, lng: member.lng, zoom: 15 } : null),
    [member],
  );
  const stack = useMemo(
    () => (member ? containingTerritories(state.territories, member.lat, member.lng) : []),
    [member, state.territories],
  );
  const listed = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${fullName(m)} ${m.suburb || ""} ${m.address}`.toLowerCase().includes(q));
  }, [members, filter]);
  if (!user) return null;

  return (
    <div className="gis-stage relative h-full min-h-0 overflow-hidden">
      <LeafletTerritoryMap
        territories={state.territories}
        churches={state.churches}
        members={members}
        users={state.users}
        selectedId={stack.find((t) => t.level === "church")?.id || stack.find((t) => t.level === "district")?.id}
        mode="browse"
        pin={member ? { lat: member.lat, lng: member.lng } : null}
        flyTo={flyTo}
        className="absolute inset-0 h-full w-full rounded-none"
      />

      <button
        type="button"
        className="gis-map-panel absolute left-3 top-3 z-20 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cyan"
        onClick={() => setListOpen((v) => !v)}
      >
        {listOpen ? "Hide members" : "Members"}
      </button>
      {listOpen && (
        <aside className="gis-map-panel absolute bottom-20 left-3 top-[3.35rem] z-20 flex w-[220px] flex-col overflow-hidden p-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find a member"
            className="gis-compact-input"
          />
          <div className="mt-2 min-h-0 flex-1 overflow-auto scrollbar-thin">
            {listed.map((m) => {
              const active = selected === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m.id)}
                  className={`mb-0.5 w-full rounded-lg px-2 py-2 text-left ${
                    active ? "bg-magenta/20 shadow-[inset_2px_0_0_#9eecff]" : "hover:bg-white/5"
                  }`}
                >
                  <div className="truncate text-[13px] font-medium">{fullName(m)}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-1">
                    <span className="truncate text-[11px] text-white/45">{m.suburb || m.address}</span>
                    <StatusBadge
                      status={isOverdue(m) ? "overdue" : memberPriority(m) === "normal" ? "due" : memberPriority(m)}
                    />
                  </div>
                  <div className="text-[10px] text-white/35">{dueLabel(m)}</div>
                </button>
              );
            })}
            {listed.length === 0 && <p className="px-2 py-6 text-center text-xs text-white/45">No matching members.</p>}
          </div>
        </aside>
      )}

      {member && (
        <div className="gis-map-panel absolute bottom-3 left-3 right-16 z-20 flex flex-wrap items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{fullName(member)}</div>
            <div className="truncate text-[11px] text-white/50">
              {stack.length
                ? stack
                    .filter((t) => t.level !== "general_conference")
                    .map((t) => `${LEVEL_LABEL[t.level]} · ${t.shortName || t.name}`)
                    .join(" → ")
                : "Outside a mapped church territory"}
            </div>
          </div>
          <Link href={`/members/${member.id}`} className="btn btn-ghost py-1.5 text-xs">
            Profile
          </Link>
          <Link href={`/members/${member.id}/edit`} className="btn btn-ghost py-1.5 text-xs">
            Pin home
          </Link>
          <Link href={`/go/${member.id}`} className="btn btn-primary py-1.5 text-xs">
            Visit
          </Link>
        </div>
      )}
    </div>
  );
}
