"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import { containingTerritories, LEVEL_LABEL } from "@/lib/gis";
import { canEditMember, dueLabel, fullName, isOverdue, memberPriority, visibleMembers } from "@/lib/utils";

const LeafletTerritoryMap = dynamic(() => import("@/components/gis/LeafletTerritoryMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-white/50">Loading care map…</div>,
});

export default function MapPage() {
  const { user, state, upsertMember } = useStore();
  const members = user ? visibleMembers(user, state.members).filter((m) => m.status === "active") : [];
  const [selected, setSelected] = useState(members[0]?.id);
  const [filter, setFilter] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [handPin, setHandPin] = useState(false);
  const [lockCamera, setLockCamera] = useState(false);
  const [view, setView] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [pinHint, setPinHint] = useState("");
  const member = members.find((m) => m.id === selected) || members[0];
  const flyTo = useMemo(() => {
    if (handPin || lockCamera) return null;
    return member ? { lat: member.lat, lng: member.lng, zoom: 16 } : null;
  }, [member, handPin, lockCamera]);
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

  const canPin = Boolean(member && canEditMember(user, member));

  function dropHandPin() {
    if (!member || !view) {
      setPinHint("Zoom so the house sits under the crosshair, then pin.");
      return;
    }
    if (view.zoom < 17) {
      setPinHint("Zoom in closer until you can see the house roof, then pin.");
      return;
    }
    upsertMember({
      ...member,
      lat: Number(view.lat.toFixed(6)),
      lng: Number(view.lng.toFixed(6)),
    });
    setPinHint(`Pinned ${fullName(member)} on the house under the crosshair.`);
    setHandPin(false);
    setLockCamera(true);
  }

  return (
    <div className="gis-stage relative h-full min-h-0 overflow-hidden">
      <LeafletTerritoryMap
        territories={state.territories}
        churches={state.churches}
        members={members}
        users={state.users}
        selectedId={stack.find((t) => t.level === "church")?.id || stack.find((t) => t.level === "district")?.id}
        mode={handPin ? "pin" : "browse"}
        pin={member ? { lat: member.lat, lng: member.lng } : null}
        pinRadius={member?.geofenceRadius}
        flyTo={flyTo}
        showCrosshair={handPin}
        baseLayer="hybrid"
        className="absolute inset-0 h-full w-full rounded-none"
        onViewChange={setView}
      />

      <button
        type="button"
        className="gis-map-panel absolute left-3 top-3 z-20 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cyan"
        onClick={() => setListOpen((v) => !v)}
      >
        {listOpen ? "Hide members" : "Members"}
      </button>
      {listOpen && (
        <aside className="gis-map-panel absolute bottom-24 left-3 right-3 top-auto z-20 flex max-h-[min(42vh,20rem)] flex-col overflow-hidden p-2 sm:right-auto sm:top-[3.35rem] sm:bottom-20 sm:max-h-none sm:w-[220px]">
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
                  onClick={() => {
                    setSelected(m.id);
                    setHandPin(false);
                    setLockCamera(false);
                    setPinHint("");
                    if (typeof window !== "undefined" && window.innerWidth < 640) setListOpen(false);
                  }}
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
        <div className="gis-map-panel absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-14 z-20 flex flex-col gap-2 px-3 py-2 sm:right-16">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
            {!handPin && (
              <div className="flex flex-wrap gap-2">
                <Link href={`/members/${member.id}`} className="btn btn-ghost py-1.5 text-xs">
                  Profile
                </Link>
                {canPin && (
                  <button
                    type="button"
                    className="btn btn-cyan py-1.5 text-xs"
                    onClick={() => {
                      setPinHint("Zoom onto the house, then Pin this house. You do not need to be there.");
                      setHandPin(true);
                      setListOpen(false);
                    }}
                  >
                    Hand pin
                  </button>
                )}
                <Link href={`/members/${member.id}/edit`} className="btn btn-ghost py-1.5 text-xs">
                  Edit
                </Link>
                <Link href={`/go/${member.id}/navigate`} className="btn btn-ghost py-1.5 text-xs">
                  Navigate
                </Link>
                <Link href={`/go/${member.id}`} className="btn btn-primary py-1.5 text-xs">
                  Visit
                </Link>
              </div>
            )}
          </div>
          {handPin && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-white/70">
                Line the house up under the crosshair. You do not need to be at the home.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary py-1.5 text-xs" onClick={dropHandPin}>
                  Pin this house
                </button>
                <button
                  type="button"
                  className="btn btn-ghost py-1.5 text-xs"
                  onClick={() => {
                    setHandPin(false);
                    setPinHint("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {pinHint && <p className="text-xs text-gold">{pinHint}</p>}
        </div>
      )}
    </div>
  );
}
