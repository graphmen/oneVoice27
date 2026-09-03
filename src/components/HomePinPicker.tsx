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
  startAt?: { lat: number; lng: number; zoom?: number };
  onChange: (coords: { lat: number; lng: number; label?: string }) => void;
};

type Hit = { display_name: string; lat: string; lon: string };
type View = { lat: number; lng: number; zoom: number };

const HAND_PIN_ZOOM = 17;

export function HomePinPicker({ lat, lng, radius, startAt, onChange }: Props) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [view, setView] = useState<View | null>(null);
  const hasPin = typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng);
  const pin = hasPin ? { lat, lng } : null;
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(() => {
    if (hasPin) return { lat: lat as number, lng: lng as number, zoom: 18 };
    if (startAt) return { lat: startAt.lat, lng: startAt.lng, zoom: startAt.zoom ?? 14 };
    return null;
  });
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
      setHint("Address search needs internet. Zoom the map and pin the house by hand.");
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

  function pinFromView() {
    if (!view) {
      setHint("Wait for the map, then line the house up under the crosshair.");
      return;
    }
    if (view.zoom < HAND_PIN_ZOOM) {
      setHint("Zoom in closer until you can see the house roof, then pin.");
      return;
    }
    drop(view.lat, view.lng, "Hand pin");
    setHint("Home pinned on the house under the crosshair. You do not need to be there. Save to keep it.");
  }

  function useGps() {
    if (!navigator.geolocation) {
      setHint("This device has no GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 18 };
        setFlyTo(next);
        drop(next.lat, next.lng, "Current GPS");
        setHint(`Pinned from GPS (±${Math.round(pos.coords.accuracy)} m).`);
      },
      () => setHint("Allow location to pin this home, or zoom the map and pin by hand instead."),
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
                const nextLat = Number(h.lat);
                const nextLng = Number(h.lon);
                setFlyTo({ lat: nextLat, lng: nextLng, zoom: 18 });
                drop(nextLat, nextLng, h.display_name);
                setHits([]);
                setQ(h.display_name);
                setHint("Street found. Zoom onto the house and tap Pin this house if the pin needs to move.");
              }}
            >
              {h.display_name}
            </button>
          ))}
        </div>
      )}
      <div className="relative h-[min(62vh,28rem)] overflow-hidden rounded-lg border border-white/10 sm:h-[32rem]">
        <LeafletTerritoryMap
          territories={state.territories}
          churches={state.churches}
          mode="pin"
          pin={pin}
          pinRadius={radius}
          flyTo={flyTo}
          compactControl
          showCrosshair
          baseLayer="hybrid"
          className="h-full w-full"
          onViewChange={setView}
        />
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex justify-center">
          <button type="button" className="pointer-events-auto btn btn-primary shadow-lg" onClick={pinFromView}>
            Pin this house
          </button>
        </div>
      </div>
      {hint && <p className="text-sm text-gold">{hint}</p>}
      {hasPin ? (
        <p className="text-xs text-white/50">
          {lat.toFixed(5)}, {lng.toFixed(5)} · geofence {radius} m
          {view ? ` · zoom ${view.zoom.toFixed(0)}` : ""}
          {stack.length
            ? ` · ${stack
                .filter((t) => t.level === "district" || t.level === "church")
                .map((t) => `${LEVEL_LABEL[t.level]} · ${t.shortName || t.name}`)
                .join(" → ")}`
            : ""}
        </p>
      ) : (
        <p className="text-sm text-white/60">
          Zoom until the house sits under the crosshair, then Pin this house. You do not need to be there. Pin my GPS is
          only if you are standing at the door.
        </p>
      )}
    </div>
  );
}
