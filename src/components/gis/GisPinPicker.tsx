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

type View = { lat: number; lng: number; zoom: number };

export function GisPinPicker({ lat, lng, onChange }: Props) {
  const { state } = useStore();
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState("");
  const [view, setView] = useState<View | null>(null);
  const hasPin = typeof lat === "number" && typeof lng === "number";
  const pin = hasPin ? { lat, lng } : null;
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(
    hasPin ? { lat: lat as number, lng: lng as number, zoom: 16 } : null,
  );

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
        setHint("No match. Zoom the map and pin by hand.");
        return;
      }
      const next = { lat: Number(data[0].lat), lng: Number(data[0].lon), zoom: 16 };
      setFlyTo(next);
      drop(next.lat, next.lng);
    } catch {
      setHint("Search needs internet. Zoom the map and pin by hand.");
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

  function pinFromView() {
    if (!view) {
      setHint("Wait for the map, then line the sanctuary up under the crosshair.");
      return;
    }
    if (view.zoom < 16) {
      setHint("Zoom in closer until you can see the site, then pin.");
      return;
    }
    drop(view.lat, view.lng);
  }

  function useGps() {
    if (!navigator.geolocation) {
      setHint("This device has no GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 17 };
        setFlyTo(next);
        drop(next.lat, next.lng);
      },
      () => setHint("Allow location, or zoom the map and pin by hand instead."),
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
      <div className="relative h-[min(52vh,22rem)] overflow-hidden rounded-lg border border-white/10 sm:h-80">
        <LeafletTerritoryMap
          territories={state.territories}
          churches={state.churches}
          mode="pin"
          pin={pin}
          flyTo={flyTo}
          compactControl
          showCrosshair
          baseLayer="hybrid"
          className="h-full w-full"
          onViewChange={setView}
        />
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex justify-center">
          <button type="button" className="pointer-events-auto btn btn-primary" onClick={pinFromView}>
            Pin this site
          </button>
        </div>
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

