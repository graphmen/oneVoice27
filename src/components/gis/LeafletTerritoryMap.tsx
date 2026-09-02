"use client";

import { useEffect, useRef, useState } from "react";
import type { Church, Member, Territory, TerritoryLevel, UserAccount } from "@/lib/types";
import { geometryBBox, geometryCentroid, LEVEL_LABEL, LEVEL_WEIGHT } from "@/lib/gis";
import "leaflet/dist/leaflet.css";

export type MapMode = "browse" | "draw" | "pin";

type Props = {
  territories: Territory[];
  churches: Church[];
  members?: Member[];
  users?: UserAccount[];
  selectedId?: string;
  mode: MapMode;
  pin?: { lat: number; lng: number } | null;
  drawLatLngs?: { lat: number; lng: number }[];
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
  className?: string;
  compactControl?: boolean;
  pinRadius?: number;
  pinLabel?: string;
  here?: { lat: number; lng: number } | null;
  hereAccuracy?: number;
  fitPoints?: { lat: number; lng: number }[] | null;
  onSelect?: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
};

const GOOGLE_BASES = [
  { label: "Google Streets", lyrs: "m" },
  { label: "Google Satellite", lyrs: "s" },
  { label: "Google Hybrid", lyrs: "y" },
] as const;

const OVERLAY_LEVELS: TerritoryLevel[] = ["division", "union", "conference", "district", "church"];

type OverlayKey = TerritoryLevel | "churchPins" | "pastors" | "homes" | "draw";

function googleUrl(lyrs: string) {
  return `https://{s}.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}`;
}

export default function LeafletTerritoryMap({
  territories,
  churches,
  members = [],
  users = [],
  selectedId,
  mode,
  pin,
  drawLatLngs = [],
  flyTo,
  className,
  compactControl = false,
  pinRadius,
  pinLabel = "Home pin",
  here,
  hereAccuracy,
  fitPoints,
  onSelect,
  onMapClick,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const overlayRef = useRef<Partial<Record<OverlayKey, import("leaflet").LayerGroup>>>({});
  const clickRef = useRef(onMapClick);
  const selectRef = useRef(onSelect);
  const modeRef = useRef(mode);
  const [ready, setReady] = useState(0);
  clickRef.current = onMapClick;
  selectRef.current = onSelect;
  modeRef.current = mode;

  useEffect(() => {
    let cancelled = false;
    if (!host.current) return;

    (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default;
      if (cancelled || !host.current) return;

      const map = L.map(host.current, {
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true,
      }).setView([-17.83, 31.05], 11);
      L.control.zoom({ position: "bottomleft" }).addTo(map);

      const bases: Record<string, import("leaflet").TileLayer> = {};
      for (const spec of GOOGLE_BASES) {
        bases[spec.label] = L.tileLayer(googleUrl(spec.lyrs), {
          attribution: "&copy; Google",
          maxZoom: 21,
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
        });
      }
      bases["Google Streets"].addTo(map);

      const groups: Partial<Record<OverlayKey, import("leaflet").LayerGroup>> = {
        division: L.layerGroup(),
        union: L.layerGroup(),
        conference: L.layerGroup().addTo(map),
        district: L.layerGroup().addTo(map),
        church: L.layerGroup().addTo(map),
        churchPins: L.layerGroup().addTo(map),
        pastors: compactControl ? L.layerGroup() : L.layerGroup().addTo(map),
        homes: compactControl ? L.layerGroup() : L.layerGroup().addTo(map),
        draw: L.layerGroup().addTo(map),
      };
      overlayRef.current = groups;

      const overlays: Record<string, import("leaflet").Layer> = {
        [LEVEL_LABEL.division]: groups.division!,
        [LEVEL_LABEL.union]: groups.union!,
        [LEVEL_LABEL.conference]: groups.conference!,
        Districts: groups.district!,
        "Church territories": groups.church!,
        "Church pins": groups.churchPins!,
      };
      if (!compactControl) {
        overlays["Pastor posts"] = groups.pastors!;
        overlays["Member homes"] = groups.homes!;
      }

      L.control
        .layers(bases, overlays, {
          position: "topright",
          collapsed: true,
          autoZIndex: true,
        })
        .addTo(map);

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        clickRef.current?.(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 80);
      setTimeout(() => map.invalidateSize(), 400);
      setReady((n) => n + 1);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      overlayRef.current = {};
    };
  }, [compactControl]);

  useEffect(() => {
    const map = mapRef.current;
    const groups = overlayRef.current;
    if (!map || !groups.district) return;
    let cancelled = false;

    (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default;
      if (cancelled || !overlayRef.current.district) return;

      for (const key of Object.keys(overlayRef.current) as OverlayKey[]) {
        if (key === "draw") continue;
        overlayRef.current[key]?.clearLayers();
      }

      const ranked = [...territories]
        .filter((t) => t.geometry && OVERLAY_LEVELS.includes(t.level))
        .sort((a, b) => LEVEL_WEIGHT[a.level] - LEVEL_WEIGHT[b.level]);

      for (const t of ranked) {
        const geo = t.geometry;
        if (!geo) continue;
        const selected = t.id === selectedId;
        const layer = L.geoJSON(geo as GeoJSON.GeoJsonObject, {
          style: {
            color: t.color,
            weight: selected ? 4 : t.level === "church" ? 1 : 1.5,
            fillColor: t.color,
            fillOpacity: selected ? 0.32 : t.level === "district" ? 0.16 : t.level === "church" ? 0.18 : 0.08,
            dashArray: selected ? undefined : t.level === "conference" ? "6 4" : undefined,
          },
        });
        layer.on("click", (e) => {
          if (modeRef.current !== "browse") return;
          L.DomEvent.stopPropagation(e);
          selectRef.current?.(t.id);
        });
        layer.bindTooltip(t.name, { sticky: true, opacity: 0.92 });
        overlayRef.current[t.level]?.addLayer(layer);
      }

      for (const c of churches) {
        const marker = L.circleMarker([c.lat, c.lng], {
          radius: 8,
          color: "#14001f",
          weight: 2,
          fillColor: "#9eecff",
          fillOpacity: 1,
        }).bindPopup(`<strong>${c.name}</strong><br/>Church sanctuary`);
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          if (c.territoryId) selectRef.current?.(c.territoryId);
        });
        overlayRef.current.churchPins?.addLayer(marker);
      }

      for (const m of members) {
        overlayRef.current.homes?.addLayer(
          L.circleMarker([m.lat, m.lng], {
            radius: 5,
            color: "#14001f",
            weight: 1,
            fillColor: "#e400ff",
            fillOpacity: 0.95,
          }).bindPopup(`${m.firstName} ${m.lastName}<br/>Member home pin`),
        );
      }

      for (const u of users.filter((x) => x.role === "pastor")) {
        const church = churches.find((c) => u.churchIds.includes(c.id));
        const territory = territories.find((t) => u.territoryIds?.includes(t.id) && t.geometry);
        const centre = church ? { lat: church.lat, lng: church.lng } : geometryCentroid(territory?.geometry);
        if (!centre) continue;
        overlayRef.current.pastors?.addLayer(
          L.circleMarker([centre.lat, centre.lng], {
            radius: 9,
            color: "#14001f",
            weight: 2,
            fillColor: "#ffc24a",
            fillOpacity: 1,
          }).bindPopup(`<strong>${u.displayName}</strong><br/>${u.title || "Pastor"}`),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [territories, churches, members, users, selectedId, ready, compactControl]);

  useEffect(() => {
    const groups = overlayRef.current;
    if (!groups.draw) return;
    let cancelled = false;

    (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default;
      if (cancelled || !overlayRef.current.draw) return;
      overlayRef.current.draw.clearLayers();

      if (drawLatLngs.length) {
        overlayRef.current.draw.addLayer(
          L.polyline(
            drawLatLngs.map((p) => [p.lat, p.lng] as [number, number]),
            { color: "#9eecff", weight: 3, dashArray: "8 6" },
          ),
        );
        for (const p of drawLatLngs) {
          overlayRef.current.draw.addLayer(
            L.circleMarker([p.lat, p.lng], {
              radius: 5,
              color: "#9eecff",
              fillColor: "#fff",
              fillOpacity: 1,
            }),
          );
        }
      }

      if (pin) {
        overlayRef.current.draw.addLayer(
          L.circleMarker([pin.lat, pin.lng], {
            radius: 10,
            color: "#fff",
            weight: 2,
            fillColor: "#ff5d7a",
            fillOpacity: 1,
          }).bindTooltip(pinLabel),
        );
        if (pinRadius) {
          overlayRef.current.draw.addLayer(
            L.circle([pin.lat, pin.lng], {
              radius: pinRadius,
              color: "#ff5d7a",
              weight: 1,
              fillColor: "#ff5d7a",
              fillOpacity: 0.12,
            }),
          );
        }
      }

      if (here) {
        if (hereAccuracy) {
          overlayRef.current.draw.addLayer(
            L.circle([here.lat, here.lng], {
              radius: hereAccuracy,
              color: "#9eecff",
              weight: 1,
              fillColor: "#9eecff",
              fillOpacity: 0.1,
            }),
          );
        }
        overlayRef.current.draw.addLayer(
          L.circleMarker([here.lat, here.lng], {
            radius: 8,
            color: "#14001f",
            weight: 2,
            fillColor: "#9eecff",
            fillOpacity: 1,
          }).bindTooltip("You"),
        );
        if (pin) {
          overlayRef.current.draw.addLayer(
            L.polyline(
              [
                [here.lat, here.lng],
                [pin.lat, pin.lng],
              ],
              { color: "#e400ff", weight: 2, dashArray: "6 6" },
            ),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [drawLatLngs, pin, pinRadius, pinLabel, here, hereAccuracy, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitPoints?.length) return;
    if (fitPoints.length === 1) {
      map.flyTo([fitPoints[0].lat, fitPoints[0].lng], 16, { duration: 0.6 });
      return;
    }
    map.fitBounds(
      fitPoints.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [56, 56], maxZoom: 17 },
    );
  }, [fitPoints, ready]);

  useEffect(() => {
    if (fitPoints?.length) return;
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const t = territories.find((x) => x.id === selectedId);
    const box = geometryBBox(t?.geometry);
    if (!box) return;
    map.fitBounds(
      [
        [box[0], box[1]],
        [box[2], box[3]],
      ],
      { padding: [36, 36], maxZoom: t?.level === "conference" ? 10 : 14 },
    );
  }, [selectedId, territories, ready, fitPoints]);

  useEffect(() => {
    if (fitPoints?.length) return;
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? 14, { duration: 0.8 });
  }, [flyTo, ready, fitPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().style.cursor = mode === "browse" ? "" : "crosshair";
  }, [mode, ready]);

  return <div ref={host} className={className || "h-full min-h-[420px] w-full rounded-lg"} />;
}
