"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useStore } from "@/lib/store";
import type { LngLat, Territory, TerritoryLevel } from "@/lib/types";
import {
  ancestors,
  childrenOf,
  churchesInTerritory,
  containingTerritories,
  descendantIds,
  geometryAreaKm2,
  LEVEL_LABEL,
  LEVEL_SHORT,
  membersInTerritory,
  parseGeoJsonGeometry,
  pastorsForTerritory,
  polygon,
  TERRITORY_LEVELS,
  toFeatureCollection,
} from "@/lib/gis";
import { EZC_CONFERENCE_ID } from "@/lib/constants";
import { ezcIndex } from "@/lib/ezc-index";
import { remapLegacyTerritoryId } from "@/lib/territory-seed";
import { canEditGis, uid } from "@/lib/utils";
import type { MapMode } from "./LeafletTerritoryMap";

const LeafletTerritoryMap = dynamic(() => import("./LeafletTerritoryMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[520px] place-items-center rounded-lg bg-black/30 text-white/60">
      Loading GIS map…
    </div>
  ),
});

const LEVEL_COLORS: Record<TerritoryLevel, string> = {
  general_conference: "#9eecff",
  division: "#7aa8ff",
  union: "#c9b8ff",
  conference: "#e400ff",
  district: "#ffc24a",
  church: "#5dffb2",
};

export function GisWorkbench({ initialId }: { compactMembers?: boolean; initialId?: string }) {
  const { user, state, upsertTerritory } = useStore();
  const [selectedId, setSelectedId] = useState(
    () => remapLegacyTerritoryId(initialId) || EZC_CONFERENCE_ID,
  );
  const [mode, setMode] = useState<MapMode>("browse");
  const [vertices, setVertices] = useState<{ lat: number; lng: number }[]>([]);
  const [query, setQuery] = useState("");
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [identify, setIdentify] = useState<{ lat: number; lng: number } | null>(null);
  const [hint, setHint] = useState("");
  const [treeOpen, setTreeOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      setTreeOpen(true);
      setInfoOpen(true);
    }
  }, []);

  const territories = state.territories || [];
  const selected = territories.find((t) => t.id === selectedId);
  const canEdit = Boolean(user && canEditGis(user));
  const boundariesReady = territories.some((t) => t.id === EZC_CONFERENCE_ID && t.geometry);

  const hits = useMemo(
    () => (identify ? containingTerritories(territories, identify.lat, identify.lng) : []),
    [identify, territories],
  );

  function onMapClick(lat: number, lng: number) {
    if (mode === "draw") {
      setVertices((v) => [...v, { lat, lng }]);
      return;
    }
    setIdentify({ lat, lng });
    const inside = containingTerritories(territories, lat, lng);
    const district = inside.find((t) => t.level === "district") || inside[0];
    if (district) setSelectedId(district.id);
  }

  async function searchPlace() {
    if (!query.trim()) return;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      if (!data[0]) {
        setHint("No matching place.");
        return;
      }
      setFlyTo({ lat: Number(data[0].lat), lng: Number(data[0].lon), zoom: 13 });
      setIdentify({ lat: Number(data[0].lat), lng: Number(data[0].lon) });
      setHint(data[0].display_name);
    } catch {
      setHint("Place search needs internet.");
    }
  }

  function saveDrawnBoundary() {
    if (!selected || vertices.length < 3) {
      setHint("Draw at least three points, then close the boundary.");
      return;
    }
    const coords: LngLat[] = vertices.map((v) => [v.lng, v.lat]);
        upsertTerritory({ ...selected, geometry: polygon(coords), geometryOverride: Boolean(selected.officialSource) });
    setVertices([]);
    setMode("browse");
    setHint(`Saved boundary for ${selected.name}.`);
  }

  function importGeoJson(file: File) {
    if (!selected) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const geometry = parseGeoJsonGeometry(parsed);
        if (!geometry) {
          setHint("That file is not a Polygon or MultiPolygon GeoJSON.");
          return;
        }
        upsertTerritory({ ...selected, geometry, geometryOverride: Boolean(selected.officialSource) });
        setHint(`Imported boundary for ${selected.name}.`);
      } catch {
        setHint("Could not read that GeoJSON file.");
      }
    };
    reader.readAsText(file);
  }

  function exportGeoJson() {
    const blob = new Blob([JSON.stringify(toFeatureCollection(territories), null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shepherd360-territories.geojson";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!user) return null;

  const breadcrumb = selected ? ancestors(territories, selected.id) : [];
  const churches = selected ? churchesInTerritory(selected, territories, state.churches) : [];
  const flock = selected ? membersInTerritory(selected, territories, state.churches, state.members) : [];
  const shepherds = selected ? pastorsForTerritory(selected, territories, state.users) : [];
  const area = selected ? geometryAreaKm2(selected.geometry) : 0;
  const churchTerritories = selected
    ? territories.filter((t) => t.level === "church" && descendantIds(territories, selected.id).has(t.id))
    : [];

  return (
    <div className="gis-stage relative h-full min-h-0 overflow-hidden">
      <LeafletTerritoryMap
        territories={territories}
        churches={state.churches}
        members={state.members}
        users={state.users}
        selectedId={selectedId}
        mode={mode}
        drawLatLngs={vertices}
        flyTo={flyTo}
        className="absolute inset-0 h-full w-full rounded-none"
        onSelect={setSelectedId}
        onMapClick={onMapClick}
      />
      {!boundariesReady && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded bg-black/55 px-3 py-1.5 text-xs text-cyan">
          Loading East Zimbabwe Conference boundaries…
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3 pr-14">
        <div className="pointer-events-auto gis-map-panel flex w-full max-w-3xl flex-wrap items-center gap-2 px-2 py-2">
          <input
            className="gis-compact-input min-w-0 w-full flex-1 basis-full sm:min-w-[160px] sm:basis-auto"
            placeholder="Search a place (Harare, Mutare…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchPlace())}
          />
          <button className="btn btn-ghost py-1.5 text-xs" type="button" onClick={searchPlace}>
            Find
          </button>
          {canEdit && selected && (
            <>
              <button
                type="button"
                className={`btn py-1.5 text-xs ${mode === "draw" ? "btn-cyan" : "btn-ghost"}`}
                onClick={() => {
                  setMode((m) => (m === "draw" ? "browse" : "draw"));
                  setVertices([]);
                  setHint("Click the map to drop boundary vertices. Close when the shape is complete.");
                }}
              >
                {mode === "draw" ? "Cancel draw" : "Draw"}
              </button>
              {mode === "draw" && (
                <button type="button" className="btn btn-primary py-1.5 text-xs" onClick={saveDrawnBoundary}>
                  Save ({vertices.length} pts)
                </button>
              )}
              <label className="btn btn-ghost py-1.5 text-xs">
                Import
                <input
                  type="file"
                  accept=".json,.geojson,application/geo+json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importGeoJson(file);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </>
          )}
          <button className="btn btn-ghost py-1.5 text-xs" type="button" onClick={exportGeoJson}>
            Export
          </button>
          {hint && <span className="max-w-full truncate text-xs text-gold sm:max-w-[220px]">{hint}</span>}
          <button
            type="button"
            className={`btn py-1.5 text-xs ${treeOpen ? "btn-cyan" : "btn-ghost"}`}
            onClick={() => {
              const opening = !treeOpen;
              setTreeOpen(opening);
              if (opening && window.innerWidth < 768) setInfoOpen(false);
            }}
          >
            {treeOpen ? "Hide hierarchy" : "Hierarchy"}
          </button>
          <button
            type="button"
            className={`btn py-1.5 text-xs ${infoOpen ? "btn-cyan" : "btn-ghost"}`}
            onClick={() => {
              const opening = !infoOpen;
              setInfoOpen(opening);
              if (opening && window.innerWidth < 768) setTreeOpen(false);
            }}
          >
            {infoOpen ? "Hide details" : "Details"}
          </button>
        </div>
      </div>
      {treeOpen && (
        <aside className="gis-map-panel absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 top-auto z-20 flex max-h-[min(48vh,24rem)] flex-col overflow-hidden p-3 md:right-auto md:top-24 md:bottom-12 md:max-h-none md:w-[280px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan">SDA hierarchy</div>
          <p className="mt-1 text-[11px] text-white/45">GC → SID → ZEUC → EZC</p>
          <p className="mt-1 text-[11px] text-white/40">
            {ezcIndex.counts.churches} churches · {ezcIndex.counts.harareDistricts + ezcIndex.counts.coverageDistricts}{" "}
            districts
          </p>
          <div className="mt-2 min-h-0 flex-1 overflow-auto scrollbar-thin">
            <TerritoryTree
              territories={territories}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setMode("browse");
                setVertices([]);
                if (window.innerWidth < 768) setTreeOpen(false);
              }}
            />
            {canEdit && (
              <CreateTerritoryForm
                territories={territories}
                selected={selected}
                onCreated={(id) => {
                  setSelectedId(id);
                  setMode("draw");
                  setVertices([]);
                  setHint("Click the map to draw the new boundary.");
                }}
              />
            )}
          </div>
        </aside>
      )}

      {infoOpen && (
        <aside className="gis-map-panel absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 top-auto z-20 max-h-[min(48vh,24rem)] overflow-auto p-3 scrollbar-thin md:left-auto md:top-24 md:bottom-12 md:max-h-none md:w-[min(280px,calc(100vw-1.5rem))]">
          {selected ? (
            <>
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">{LEVEL_LABEL[selected.level]}</div>
              <h2 className="mt-1 text-lg font-semibold">{selected.name}</h2>
              <p className="mt-2 text-xs text-white/50">{breadcrumb.map((t) => t.shortName || t.name).join(" → ")}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm">
                <Stat label="Area" value={area ? `${area.toFixed(0)} km²` : "No polygon"} />
                <Stat label="Churches" value={String(Math.max(churches.length, churchTerritories.length))} />
                <Stat label="Shepherds" value={String(shepherds.length)} />
                <Stat label="Members" value={String(flock.length)} />
              </div>
              <h3 className="mt-5 text-sm font-semibold">Pastors covering this territory</h3>
              <div className="mt-2 grid gap-2">
                {shepherds.length === 0 && <p className="text-sm text-white/50">No pastor assigned yet.</p>}
                {shepherds.map((p) => (
                  <Link key={p.id} href="/pastors" className="rounded-lg bg-white/5 px-3 py-2 text-sm">
                    {p.displayName}
                    <div className="text-xs text-white/50">{p.title}</div>
                  </Link>
                ))}
              </div>
              <h3 className="mt-5 text-sm font-semibold">Church territories inside</h3>
              <div className="mt-2 grid gap-2">
                {churchTerritories.length > 40 && selected.level !== "district" && selected.level !== "church" && (
                  <p className="text-sm text-white/50">
                    {churchTerritories.length} official church territories. Open a district in the tree to list them.
                  </p>
                )}
                {(selected.level === "district" || selected.level === "church" || churchTerritories.length <= 40
                  ? churchTerritories
                  : []
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className="rounded-lg bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10"
                  >
                    {t.name}
                  </button>
                ))}
                {churches
                  .filter((c) => !churchTerritories.some((t) => t.churchId === c.id || t.id === c.territoryId))
                  .map((c) => (
                    <Link key={c.id} href="/churches" className="rounded-lg bg-white/5 px-3 py-2 text-sm">
                      {c.name}
                    </Link>
                  ))}
              </div>
              {identify && (
                <div className="mt-5 rounded-lg border border-cyan/30 bg-cyan/5 p-3 text-sm">
                  <div className="text-xs uppercase tracking-[0.16em] text-cyan">Identify</div>
                  <p className="mt-1 text-white/70">
                    {identify.lat.toFixed(5)}, {identify.lng.toFixed(5)}
                  </p>
                  <ul className="mt-2 grid gap-1 text-white/80">
                    {hits.map((t) => (
                      <li key={t.id}>
                        <button type="button" className="text-left hover:text-cyan" onClick={() => setSelectedId(t.id)}>
                          {LEVEL_LABEL[t.level]} · {t.name}
                        </button>
                      </li>
                    ))}
                    {hits.length === 0 && <li>Outside drawn territories.</li>}
                  </ul>
                </div>
              )}
              {selected.notes && <p className="mt-4 text-xs text-white/50">{selected.notes}</p>}
            </>
          ) : (
            <p className="text-white/60">Select a territory in the tree or click the map.</p>
          )}
        </aside>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-3">
      <div className="text-[11px] uppercase tracking-widest text-white/45">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function TerritoryTree({
  territories,
  selectedId,
  onSelect,
}: {
  territories: Territory[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [openIds, setOpenIds] = useState(
    () => new Set([ezcIndex.gc.id, ezcIndex.division.id, ezcIndex.union.id, ezcIndex.conference.id]),
  );

  useEffect(() => {
    if (!selectedId) return;
    setOpenIds((cur) => {
      const next = new Set(cur);
      for (const node of ancestors(territories, selectedId)) {
        if (node.id !== selectedId) next.add(node.id);
      }
      return next;
    });
  }, [selectedId, territories]);

  const query = filter.trim().toLowerCase();
  const matchIds = useMemo(() => {
    if (!query) return null;
    const ids = new Set<string>();
    for (const t of territories) {
      const hay = `${t.name} ${t.shortName || ""}`.toLowerCase();
      if (!hay.includes(query)) continue;
      for (const node of ancestors(territories, t.id)) ids.add(node.id);
    }
    return ids;
  }, [query, territories]);

  function toggle(id: string) {
    setOpenIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pathIds = useMemo(
    () => new Set(ancestors(territories, selectedId).map((t) => t.id)),
    [territories, selectedId],
  );

  return (
    <div className="mt-3">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter districts and churches"
        className="gis-compact-input mb-2"
      />
      <div className="gis-tree" role="tree" aria-label="SDA territories">
        <TreeBranch
          territories={territories}
          selectedId={selectedId}
          pathIds={pathIds}
          onSelect={onSelect}
          openIds={openIds}
          matchIds={matchIds}
          onToggle={toggle}
        />
      </div>
    </div>
  );
}

function treeLabel(t: Territory) {
  if (t.level === "district" || t.level === "church") return t.name;
  return t.shortName || t.name;
}

function TreeBranch({
  territories,
  selectedId,
  pathIds,
  onSelect,
  parentId,
  depth = 0,
  openIds,
  matchIds,
  onToggle,
}: {
  territories: Territory[];
  selectedId?: string;
  pathIds: Set<string>;
  onSelect: (id: string) => void;
  parentId?: string;
  depth?: number;
  openIds: Set<string>;
  matchIds: Set<string> | null;
  onToggle: (id: string) => void;
}) {
  const nodes = childrenOf(territories, parentId).filter((t) => !matchIds || matchIds.has(t.id));
  return (
    <>
      {nodes.map((t) => {
        const kids = childrenOf(territories, t.id);
        const expanded = matchIds ? matchIds.has(t.id) && kids.some((k) => matchIds.has(k.id)) : openIds.has(t.id);
        const selected = selectedId === t.id;
        return (
          <div key={t.id}>
            <div
              className={`gis-tree-row ${selected ? "is-selected" : ""} ${pathIds.has(t.id) ? "is-path" : ""}`}
              style={{ paddingLeft: 4 + depth * 12 }}
              role="treeitem"
              aria-selected={selected}
              tabIndex={0}
              onClick={() => onSelect(t.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(t.id);
                }
              }}
            >
              {kids.length > 0 ? (
                <button
                  type="button"
                  className="gis-tree-chevron"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(t.id);
                  }}
                  aria-label={expanded ? "Collapse" : "Expand"}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path
                      d="M3.2 1.5 7 5 3.2 8.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      transform={expanded ? "rotate(90 5 5)" : undefined}
                    />
                  </svg>
                </button>
              ) : (
                <span className="gis-tree-chevron-spacer" />
              )}
              <span className="gis-tree-swatch" style={{ background: t.color }} />
              <span className="gis-tree-name" title={t.name}>
                {treeLabel(t)}
              </span>
              {kids.length > 0 && <span className="gis-tree-meta">{kids.length}</span>}
              <span className="gis-tree-meta">{LEVEL_SHORT[t.level]}</span>
            </div>
            {expanded && kids.length > 0 && (
              <TreeBranch
                territories={territories}
                selectedId={selectedId}
                pathIds={pathIds}
                onSelect={onSelect}
                parentId={t.id}
                depth={depth + 1}
                openIds={openIds}
                matchIds={matchIds}
                onToggle={onToggle}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function CreateTerritoryForm({
  territories,
  selected,
  onCreated,
}: {
  territories: Territory[];
  selected?: Territory;
  onCreated: (id: string) => void;
}) {
  const { upsertTerritory } = useStore();
  const defaultLevel: TerritoryLevel = selected
    ? TERRITORY_LEVELS[Math.min(TERRITORY_LEVELS.indexOf(selected.level) + 1, TERRITORY_LEVELS.length - 1)]
    : "district";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const level = String(fd.get("level")) as TerritoryLevel;
    const parentId = String(fd.get("parentId") || "") || undefined;
    const id = uid("ter");
    const next: Territory = {
      id,
      name: String(fd.get("name")),
      shortName: String(fd.get("shortName") || "") || undefined,
      level,
      parentId,
      color: LEVEL_COLORS[level],
      assignedPastorIds: [],
    };
    upsertTerritory(next);
    e.currentTarget.reset();
    onCreated(id);
  }

  return (
    <form className="mt-5 grid gap-2 border-t border-white/10 pt-4" onSubmit={onSubmit}>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Register territory</div>
      <input className="gis-compact-input" name="name" placeholder="Name" required />
      <input className="gis-compact-input" name="shortName" placeholder="Short name" />
      <select className="gis-compact-input" name="level" defaultValue={defaultLevel}>
        {TERRITORY_LEVELS.map((l) => (
          <option key={l} value={l}>
            {LEVEL_LABEL[l]}
          </option>
        ))}
      </select>
      <select className="gis-compact-input" name="parentId" defaultValue={selected?.id || EZC_CONFERENCE_ID}>
        <option value="">No parent (General Conference)</option>
        {territories
          .filter((t) => t.level !== "church")
          .map((t) => (
            <option key={t.id} value={t.id}>
              {LEVEL_LABEL[t.level]} · {t.shortName || t.name}
            </option>
          ))}
      </select>
      <button className="btn btn-primary w-fit py-2 text-xs">Add & draw boundary</button>
    </form>
  );
}
