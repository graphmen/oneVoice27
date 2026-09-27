"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { gpsFailureMessage, parseCoordinates, searchStreet, validCoordinates, type GeocodeHit } from "@/lib/geocode";
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

type View = { lat: number; lng: number; zoom: number };
type Flight = { lat: number; lng: number; zoom: number; token: number };

export function HomePinPicker({ lat, lng, radius, startAt, onChange }: Props) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [manualLat, setManualLat] = useState(typeof lat === "number" ? String(lat) : "");
  const [manualLng, setManualLng] = useState(typeof lng === "number" ? String(lng) : "");
  const hasPin = typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng);
  const pin = hasPin ? { lat, lng } : null;
  const [flyTo, setFlyTo] = useState<Flight | null>(() => {
    if (hasPin) return { lat: lat as number, lng: lng as number, zoom: 18, token: 1 };
    if (startAt) return { lat: startAt.lat, lng: startAt.lng, zoom: startAt.zoom ?? 14, token: 1 };
    return null;
  });
  const stack = useMemo(
    () => (hasPin ? containingTerritories(state.territories, lat, lng) : []),
    [hasPin, lat, lng, state.territories],
  );

  function drop(nextLat: number, nextLng: number, label?: string) {
    const next = { lat: Number(nextLat.toFixed(6)), lng: Number(nextLng.toFixed(6)) };
    setManualLat(String(next.lat));
    setManualLng(String(next.lng));
    onChange({ ...next, label });
  }

  function goTo(nextLat: number, nextLng: number, zoom: number, label?: string, pinNow = true) {
    setFlyTo({ lat: nextLat, lng: nextLng, zoom, token: Date.now() });
    setView({ lat: nextLat, lng: nextLng, zoom });
    if (pinNow) drop(nextLat, nextLng, label);
  }

  async function search() {
    if (!q.trim()) {
      setHint("Type a street, suburb, or city first.");
      return;
    }
    setBusy(true);
    setHint("Searching…");
    try {
      const data = await searchStreet(q);
      setHits(data);
      setHint(data.length ? "Tap a result, then zoom onto the house if the pin needs to move." : "No matching place. Try a suburb plus city, e.g. Gunhill Harare.");
    } catch {
      setHits([]);
      setHint("Street search needs internet. Enter coordinates or zoom the map and pin the house by hand.");
    } finally {
      setBusy(false);
    }
  }

  function pinFromView() {
    const center = view || flyTo;
    if (!center) {
      setHint("Wait for the map, then line the house up under the crosshair.");
      return;
    }
    if (center.zoom < 16) {
      goTo(center.lat, center.lng, 18, undefined, false);
      setHint("Zoomed onto this spot. Line the roof under the crosshair, then tap Pin this house.");
      return;
    }
    drop(center.lat, center.lng, "Hand pin");
    setHint("Home pinned on the house under the crosshair. You do not need to be there. Save to keep it.");
  }

  function useGps() {
    if (!navigator.geolocation) {
      setHint("This device has no GPS. Enter coordinates or pin the house on the map.");
      return;
    }
    setGpsBusy(true);
    setHint("Reading GPS…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsBusy(false);
        goTo(pos.coords.latitude, pos.coords.longitude, 18, "Current GPS");
        setHint(`Pinned from GPS (±${Math.round(pos.coords.accuracy)} m).`);
      },
      (err) => {
        setGpsBusy(false);
        setHint(gpsFailureMessage(err));
      },
      { enableHighAccuracy: true, timeout: 25_000, maximumAge: 0 },
    );
  }

  function applyManual() {
    const pasted = parseCoordinates(manualLat) || parseCoordinates(`${manualLat},${manualLng}`);
    const next = pasted || validCoordinates(Number(manualLat), Number(manualLng));
    if (!next) {
      setHint("Enter valid latitude and longitude, e.g. -17.8292 and 31.0522.");
      return;
    }
    goTo(next.lat, next.lng, 18, "Manual coordinates");
    setHint("Pinned from the coordinates you entered.");
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          name="streetSearch"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
          placeholder="Search the street, suburb, or city"
        />
        <button type="button" className="btn btn-ghost" onClick={search} disabled={busy}>
          {busy ? "Searching…" : "Search street"}
        </button>
        <button type="button" className="btn btn-cyan" onClick={useGps} disabled={gpsBusy}>
          {gpsBusy ? "Reading GPS…" : "Pin my GPS"}
        </button>
      </div>
      {hits.length > 0 && (
        <div className="grid gap-1">
          {hits.map((h) => (
            <button
              key={`${h.lat}-${h.lng}-${h.label}`}
              type="button"
              className="rounded-lg bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10"
              onClick={() => {
                goTo(h.lat, h.lng, 18, h.label);
                setHits([]);
                setQ(h.label);
                setHint("Street found. Zoom onto the house and tap Pin this house if the pin needs to move.");
              }}
            >
              {h.label}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="text-xs uppercase tracking-[0.18em] text-white/50">Or enter coordinates</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            inputMode="decimal"
            name="manualLat"
            autoComplete="off"
            placeholder="Latitude e.g. -17.8292"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyManual())}
          />
          <input
            inputMode="decimal"
            name="manualLng"
            autoComplete="off"
            placeholder="Longitude e.g. 31.0522"
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyManual())}
          />
          <button type="button" className="btn btn-ghost" onClick={applyManual}>
            Apply coordinates
          </button>
        </div>
        <p className="mt-2 text-xs text-white/45">You can paste a pair in latitude, like -17.8292, 31.0522.</p>
      </div>
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
          onMapClick={(nextLat, nextLng) => {
            drop(nextLat, nextLng, "Map tap");
            setHint("Home pinned where you tapped. Save to keep it.");
          }}
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
          Search the street, enter coordinates, tap the house, or zoom until it sits under the crosshair and tap Pin
          this house. Pin my GPS is only if you are standing at the door.
        </p>
      )}
    </div>
  );
}
