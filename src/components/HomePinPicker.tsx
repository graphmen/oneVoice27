"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { containingTerritories, LEVEL_LABEL } from "@/lib/gis";

const LeafletTerritoryMap = dynamic(() => import("@/components/gis/LeafletTerritoryMap"), {
  ssr: false,
  loading: () => <div className="grid h-64 place-items-center text-sm text-white/50">Loading map…</div>,
});

type Props = {
  lat: number | "";
  lng: number | "";
  radius: number;
  onChange: (coords: { lat: number; lng: number; label?: string }) => void;
};

type Hit = { display_name: string; lat: string; lon: string };

export function HomePinPicker({ lat, lng, radius, onChange }: Props) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const hasPin = typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng);
  const pin = hasPin ? { lat, lng } : null;
  const flyTo = useMemo(() => (hasPin ? { lat, lng, zoom: 16 } : null), [hasPin, lat, lng]);
  const stack = useMemo(
    () => (hasPin ? containingTerritories(state.territories, lat, lng) : []),
    [hasPin, lat, lng, state.territories],
  );

  async function search() {
    if (!q.trim()) return;
    setBusy(true);
    setHint("");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = (await res.json()) as Hit[];
      setHits(data);
      if (!data.length) setHint("No matching place. Try a suburb plus city, e.g. Gunhill Harare.");
    } catch {
      setHint("Address search needs internet. You can still click the map or drop a GPS pin.");
    } finally {
      setBusy(false);
    }
  }

  function drop(nextLat: number, nextLng: number, label?: string) {
    onChange({
      lat: Number(nextLat.toFixed(6)),
      lng: Number(nextLng.toFixed(6)),
      label,
    });
  }

  function useGps() {
    if (!navigator.geolocation) {
      setHint("This device has no GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        drop(pos.coords.latitude, pos.coords.longitude, "Current GPS");
        setHint(`Pinned from GPS (±${Math.round(pos.coords.accuracy)} m).`);
      },
      () => setHint("Allow location to pin this home."),
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
          placeholder="Search the street, suburb, or city"
        />
        <button type="button" className="btn btn-ghost" onClick={search} disabled={busy}>
          {busy ? "Searching…" : "Search street"}
        </button>
        <button type="button" className="btn btn-cyan" onClick={useGps}>
          Pin my GPS
        </button>
      </div>
      {hits.length > 0 && (
        <div className="grid gap-1">
          {hits.map((h) => (
            <button
              key={`${h.lat}-${h.lon}-${h.display_name}`}
              type="button"
              className="rounded-lg bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10"
              onClick={() => {
                drop(Number(h.lat), Number(h.lon), h.display_name);
                setHits([]);
                setQ(h.display_name);
              }}
            >
              {h.display_name}
            </button>
          ))}
        </div>
      )}
      <div className="h-72 overflow-hidden rounded-lg border border-white/10">
        <LeafletTerritoryMap
          territories={state.territories}
          churches={state.churches}
          mode="pin"
          pin={pin}
          pinRadius={radius}
          flyTo={flyTo}
          compactControl
          className="h-full w-full"
          onMapClick={(nextLat, nextLng) => drop(nextLat, nextLng)}
        />
      </div>
      {hint && <p className="text-sm text-gold">{hint}</p>}
      {hasPin ? (
        <p className="text-xs text-white/50">
          {lat.toFixed(5)}, {lng.toFixed(5)} · geofence {radius} m
          {stack.length
            ? ` · ${stack
                .filter((t) => t.level === "district" || t.level === "church")
                .map((t) => `${LEVEL_LABEL[t.level]} · ${t.shortName || t.name}`)
                .join(" → ")}`
            : ""}
        </p>
      ) : (
        <p className="text-sm text-white/60">Click the map, search the street, or stand at the door and pin GPS.</p>
      )}
    </div>
  );
}
