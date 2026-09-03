"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { containingTerritories, LEVEL_LABEL, territoryAtLevel } from "@/lib/gis";

const LeafletTerritoryMap = dynamic(() => import("./LeafletTerritoryMap"), {
  ssr: false,
  loading: () => <div className="grid h-64 place-items-center text-sm text-white/50">Loading map…</div>,
});

type Props = {
  lat: number | "";
  lng: number | "";
  onChange: (coords: { lat: number; lng: number; districtId?: string; territoryId?: string }) => void;
};

export function GisPinPicker({ lat, lng, onChange }: Props) {
  const { state } = useStore();
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState("");
  const hasPin = typeof lat === "number" && typeof lng === "number";
  const pin = hasPin ? { lat, lng } : null;
  const flyTo = useMemo(() => (hasPin ? { lat, lng, zoom: 14 } : null), [hasPin, lat, lng]);

  const stack = useMemo(
    () => (hasPin ? containingTerritories(state.territories, lat, lng) : []),
    [hasPin, lat, lng, state.territories],
  );

  async function search() {
    if (!query.trim()) return;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = (await res.json()) as { lat: string; lon: string }[];
      if (!data[0]) {
        setHint("No match. Click the map instead.");
        return;
      }
      drop(Number(data[0].lat), Number(data[0].lon));
    } catch {
      setHint("Search needs internet. Click the map to pin.");
    }
  }

  function drop(nextLat: number, nextLng: number) {
    const district = territoryAtLevel(state.territories, nextLat, nextLng, "district");
    const churchTer = territoryAtLevel(state.territories, nextLat, nextLng, "church");
    onChange({
      lat: Number(nextLat.toFixed(6)),
      lng: Number(nextLng.toFixed(6)),
      districtId: district?.id,
      territoryId: churchTer?.id,
    });
    setHint(
      district
        ? `Pinned inside ${district.name}${churchTer ? ` · ${churchTer.name}` : ""}.`
        : "Pinned. This point is outside a drawn district — assign the district in the form.",
    );
  }

  function useGps() {
    if (!navigator.geolocation) {
      setHint("This device has no GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => drop(pos.coords.latitude, pos.coords.longitude),
      () => setHint("Allow location to pin this site."),
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
          placeholder="Search church / district location"
        />
        <button type="button" className="btn btn-ghost" onClick={search}>
          Search
        </button>
        <button type="button" className="btn btn-cyan" onClick={useGps}>
          Pin my GPS
        </button>
      </div>
      <div className="h-[min(40vh,18rem)] overflow-hidden rounded-lg border border-white/10 sm:h-72">
        <LeafletTerritoryMap
          territories={state.territories}
          churches={state.churches}
          mode="pin"
          pin={pin}
          flyTo={flyTo}
          compactControl
          className="h-full w-full"
          onMapClick={drop}
        />
      </div>
      {hint && <p className="text-sm text-gold">{hint}</p>}
      {stack.length > 0 && (
        <p className="text-xs text-white/55">
          Hierarchy at pin: {stack.map((t) => `${LEVEL_LABEL[t.level]} (${t.shortName || t.name})`).join(" → ")}
        </p>
      )}
    </div>
  );
}
