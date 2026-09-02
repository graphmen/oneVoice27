"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { EZC_CONFERENCE_ID } from "@/lib/constants";
import { ancestors, childrenOf, LEVEL_LABEL } from "@/lib/gis";
import type { Territory } from "@/lib/types";

export type HierarchyPick = {
  conferenceId: string;
  districtId: string;
  churchTerritoryId?: string;
  churchId?: string;
};

type Props = {
  value?: Partial<HierarchyPick>;
  onChange?: (next: HierarchyPick) => void;
  leaf?: "district" | "church";
  showGisChurches?: boolean;
};

function treeLabel(t: Territory) {
  if (t.level === "district" || t.level === "church") return t.name;
  return t.shortName || t.name;
}

export function HierarchyPicker({
  value,
  onChange,
  leaf = "church",
  showGisChurches = true,
}: Props) {
  const { state } = useStore();
  const [districtQuery, setDistrictQuery] = useState("");
  const conference =
    state.territories.find((t) => t.id === (value?.conferenceId || EZC_CONFERENCE_ID)) ||
    state.territories.find((t) => t.level === "conference");
  const path = conference ? ancestors(state.territories, conference.id) : [];
  const districts = useMemo(() => {
    const q = districtQuery.trim().toLowerCase();
    return childrenOf(state.territories, conference?.id)
      .filter((t) => t.level === "district")
      .filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [state.territories, conference?.id, districtQuery]);

  const districtId = value?.districtId || districts[0]?.id || "";
  const district = state.territories.find((t) => t.id === districtId);

  const gisChurches = childrenOf(state.territories, districtId).filter((t) => t.level === "church");
  const registered = state.churches.filter((c) => c.districtId === districtId);
  const churchTerritoryId = value?.churchTerritoryId || "";
  const churchId =
    value?.churchId ||
    registered.find((c) => c.territoryId === churchTerritoryId)?.id ||
    gisChurches.find((t) => t.id === churchTerritoryId)?.churchId ||
    "";

  function emit(patch: Partial<HierarchyPick>) {
    const nextDistrict = patch.districtId ?? districtId;
    const nextTerritory = patch.churchTerritoryId ?? (patch.districtId ? "" : churchTerritoryId);
    const linked = state.territories.find((t) => t.id === nextTerritory);
    const nextChurch =
      patch.churchId ??
      linked?.churchId ??
      state.churches.find((c) => c.territoryId === nextTerritory)?.id ??
      (patch.districtId ? "" : churchId);
    onChange?.({
      conferenceId: conference?.id || EZC_CONFERENCE_ID,
      districtId: nextDistrict,
      churchTerritoryId: nextTerritory || undefined,
      churchId: nextChurch || undefined,
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        {path.map((t) => (
          <span key={t.id} className="rounded bg-white/8 px-2.5 py-1 text-[11px] text-white/70">
            {LEVEL_LABEL[t.level]} · {treeLabel(t)}
          </span>
        ))}
      </div>

      <label className="text-sm text-white/70">
        District
        <input
          className="gis-compact-input mt-1"
          value={districtQuery}
          onChange={(e) => setDistrictQuery(e.target.value)}
          placeholder="Filter districts"
        />
        <select
          className="gis-compact-input mt-2"
          value={districtId}
          onChange={(e) => emit({ districtId: e.target.value, churchTerritoryId: "", churchId: "" })}
        >
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      {leaf === "church" && (
        <label className="text-sm text-white/70">
          Church
          <select
            className="gis-compact-input mt-1"
            value={churchTerritoryId || churchId}
            onChange={(e) => {
              const id = e.target.value;
              const gis = gisChurches.find((t) => t.id === id);
              const rec = registered.find((c) => c.id === id);
              emit({
                churchTerritoryId: gis?.id || rec?.territoryId || "",
                churchId: rec?.id || gis?.churchId || "",
              });
            }}
          >
            <option value="">{showGisChurches ? "District only — pick a church if needed" : "Select a church"}</option>
            {registered.length > 0 && (
              <optgroup label="Registered congregations">
                {registered.map((c) => (
                  <option key={c.id} value={c.territoryId || c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            {showGisChurches && gisChurches.length > 0 && (
              <optgroup label="Mapped church territories">
                {gisChurches.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.churchId ? "" : " (mapped)"}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      )}

      {district && (
        <p className="text-xs text-white/45">
          Placing into {path.map((t) => t.shortName || t.name).join(" → ")}
          {district ? ` → ${district.name}` : ""}
          {churchTerritoryId
            ? ` → ${state.territories.find((t) => t.id === churchTerritoryId)?.name || ""}`
            : ""}
        </p>
      )}
    </div>
  );
}
