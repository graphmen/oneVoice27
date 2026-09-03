"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { GisPinPicker } from "@/components/gis/GisPinPicker";
import { HierarchyPicker, type HierarchyPick } from "@/components/HierarchyPicker";
import { useStore } from "@/lib/store";
import { circlePolygon } from "@/lib/gis";
import { EZC_CONFERENCE_ID } from "@/lib/constants";
import { demoLinks } from "@/lib/ezc-index";
import type { Church, Territory } from "@/lib/types";
import { uid } from "@/lib/utils";

export function ChurchForm({
  church,
  pick: controlledPick,
  onPickChange,
  hidePlacement = false,
  onSaved,
  defaultName,
}: {
  church?: Church;
  pick?: HierarchyPick;
  onPickChange?: (next: HierarchyPick) => void;
  hidePlacement?: boolean;
  onSaved?: (church: Church) => void;
  defaultName?: string;
}) {
  const { user, state, upsertChurch, upsertTerritory, upsertUser } = useStore();
  const router = useRouter();
  const [error, setError] = useState("");
  const [lat, setLat] = useState<number | "">(church?.lat ?? "");
  const [lng, setLng] = useState<number | "">(church?.lng ?? "");
  const [localPick, setLocalPick] = useState<HierarchyPick>({
    conferenceId: EZC_CONFERENCE_ID,
    districtId: church?.districtId || demoLinks.harareCentralDistrictId,
    churchTerritoryId: church?.territoryId,
    churchId: church?.id,
  });
  const pick = controlledPick || localPick;
  const setPick = onPickChange || setLocalPick;

  if (!user) return null;
  const actor = user;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (typeof lat !== "number" || typeof lng !== "number") {
      setError("Pin the sanctuary on the map before saving.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name"));
    const churchId = church?.id || uid("ch");
    const existing = state.territories.find((t) => t.id === pick.churchTerritoryId && t.level === "church");
    const territoryId = church?.territoryId || existing?.id || uid("ter");
    const next: Church = {
      id: churchId,
      name,
      regionId: church?.regionId || state.regions[0]?.id || "reg_harare",
      districtId: pick.districtId,
      territoryId,
      address: String(fd.get("address")),
      city: String(fd.get("city")),
      lat,
      lng,
    };
    upsertChurch(next);
    if (existing) {
      upsertTerritory({
        ...existing,
        churchId,
        name: existing.officialSource ? existing.name : existing.name || name,
        parentId: pick.districtId,
        pin: { lat, lng },
      });
    } else {
      const linked = state.territories.find((t) => t.id === territoryId);
      if (linked) {
        upsertTerritory({ ...linked, churchId, parentId: pick.districtId, pin: { lat, lng } });
      } else {
        const territory: Territory = {
          id: territoryId,
          name,
          level: "church",
          parentId: pick.districtId,
          churchId,
          color: "#5dffb2",
          assignedPastorIds: [],
          geometry: circlePolygon(lat, lng, 1200),
          pin: { lat, lng },
          notes: "Catchment started as a 1.2 km ring around the sanctuary. Draw the true boundary in GIS.",
        };
        upsertTerritory(territory);
      }
    }
    if (actor.role === "church_admin" && !actor.churchIds.includes(churchId)) {
      upsertUser({ ...actor, churchIds: [...actor.churchIds, churchId] });
    }
    if (onSaved) onSaved(next);
    else router.push("/churches");
  }

  return (
    <form className="glass mt-4 grid gap-3 rounded-lg p-5" onSubmit={onSubmit}>
      {!hidePlacement && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan">Place in EZC</div>
          <div className="mt-3">
            <HierarchyPicker value={pick} onChange={setPick} leaf="church" />
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" placeholder="Church name" required defaultValue={church?.name || defaultName} />
        <input name="city" placeholder="City" required defaultValue={church?.city} />
        <input name="address" placeholder="Sanctuary address" className="sm:col-span-2" required defaultValue={church?.address} />
      </div>
      <GisPinPicker
        lat={lat}
        lng={lng}
        onChange={(coords) => {
          setLat(coords.lat);
          setLng(coords.lng);
          if (coords.districtId) {
            setPick({
              ...pick,
              districtId: coords.districtId || pick.districtId,
              churchTerritoryId: coords.territoryId || pick.churchTerritoryId,
            });
          }
        }}
      />
      {error && <p className="text-sm text-rose">{error}</p>}
      <button className="btn btn-primary w-full sm:w-fit" disabled={typeof lat !== "number"}>
        {church ? "Save church" : "Register church"}
      </button>
    </form>
  );
}
