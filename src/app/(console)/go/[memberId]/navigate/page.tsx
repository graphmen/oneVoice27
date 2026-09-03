"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { IconNav } from "@/components/icons";
import { useStore } from "@/lib/store";
import {
  formatDuration,
  formatMeters,
  insideGeofence,
  nearestDistance,
  remainingMeters,
  watchGps,
} from "@/lib/geo";
import { currentStepIndex, fetchDriveRoute, straightLineRoute, type DriveRoute } from "@/lib/route";
import type { GpsFix } from "@/lib/types";
import { fullName } from "@/lib/utils";

const LeafletTerritoryMap = dynamic(() => import("@/components/gis/LeafletTerritoryMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-white/50">Loading One Voice 27 navigation…</div>,
});

const OFF_ROUTE_M = 80;

export default function NavigatePage() {
  const { memberId } = useParams<{ memberId: string }>();
  const { user, state } = useStore();
  const member = state.members.find((m) => m.id === memberId);
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [route, setRoute] = useState<DriveRoute | null>(null);
  const [routeHint, setRouteHint] = useState("Finding the road to the home…");
  const [following, setFollowing] = useState(true);
  const [routeFitted, setRouteFitted] = useState(false);
  const lastFetch = useRef(0);
  const fetching = useRef(false);

  useEffect(() => {
    const stop = watchGps(setFix, setGpsError);
    return stop;
  }, []);

  const loadRoute = useCallback(
    async (from: { lat: number; lng: number }, force = false) => {
      if (!member) return;
      const now = Date.now();
      if (fetching.current) return;
      if (!force && now - lastFetch.current < 12_000) return;
      fetching.current = true;
      lastFetch.current = now;
      try {
        const next = await fetchDriveRoute(from, { lat: member.lat, lng: member.lng });
        setRoute(next);
        setRouteHint("");
      } catch {
        setRoute(straightLineRoute(from, { lat: member.lat, lng: member.lng }));
        setRouteHint("Road directions need internet. Showing a direct line until a route is found.");
      } finally {
        fetching.current = false;
      }
    },
    [member],
  );

  useEffect(() => {
    if (!fix || !member) return;
    if (!route) {
      void loadRoute(fix, true);
      return;
    }
    const off = nearestDistance(route.points, fix).distance > OFF_ROUTE_M;
    const stale = Date.now() - lastFetch.current > 45_000;
    if (off || stale) void loadRoute(fix, off);
  }, [fix, member, route, loadRoute]);

  useEffect(() => {
    if (!route || routeFitted) return;
    const t = window.setTimeout(() => setRouteFitted(true), 800);
    return () => window.clearTimeout(t);
  }, [route, routeFitted]);

  const geo = useMemo(() => (fix && member ? insideGeofence(fix, member) : null), [fix, member]);
  const stepIndex = useMemo(() => {
    if (!route || !fix) return 0;
    return currentStepIndex(route.steps, fix);
  }, [route, fix]);
  const step = route?.steps[stepIndex];
  const remainM = useMemo(() => {
    if (!route || !fix) return route?.distance || 0;
    return remainingMeters(route.points, fix);
  }, [route, fix]);
  const remainSec = route && route.distance ? route.duration * (remainM / Math.max(route.distance, 1)) : route?.duration || 0;
  const follow = useMemo(() => {
    if (!following || !routeFitted || !fix) return null;
    return { lat: Number(fix.lat.toFixed(4)), lng: Number(fix.lng.toFixed(4)) };
  }, [following, routeFitted, fix]);
  const fitPoints = useMemo(() => {
    if (routeFitted && following) return null;
    if (route?.points.length) return route.points;
    if (member && fix) return [fix, { lat: member.lat, lng: member.lng }];
    return member ? [{ lat: member.lat, lng: member.lng }] : null;
  }, [routeFitted, following, fix, route, member]);

  if (!user || !member) return <p>Member not found.</p>;
  if (user.role !== "pastor" || member.assignedPastorId !== user.id) {
    return (
      <p className="text-white/70">
        In-app navigation is for the assigned shepherd. Open this household from{" "}
        <Link href="/dashboard" className="text-cyan">
          Today’s flock
        </Link>
        .
      </p>
    );
  }

  const church = state.churches.find((c) => c.id === member.churchId);
  const arrived = Boolean(geo?.inside);

  return (
    <div className="gis-stage relative h-full min-h-0 overflow-hidden">
      <LeafletTerritoryMap
        territories={state.territories}
        churches={state.churches}
        mode="browse"
        pin={{ lat: member.lat, lng: member.lng }}
        pinRadius={member.geofenceRadius}
        pinLabel={`${fullName(member)} · home`}
        here={fix ? { lat: fix.lat, lng: fix.lng } : null}
        hereAccuracy={fix?.accuracy}
        routeLine={route?.points || null}
        follow={follow}
        fitPoints={fitPoints}
        compactControl
        className="absolute inset-0 h-full w-full rounded-none"
      />

      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3 pr-14">
        <div className="pointer-events-auto gis-map-panel flex w-full max-w-xl items-center gap-2 px-3 py-2">
          <Link href={`/go/${member.id}`} className="btn btn-ghost shrink-0 py-1.5 text-xs">
            Back
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan">
              <IconNav size={14} /> One Voice 27 navigation
            </div>
            <div className="truncate text-sm font-medium">{fullName(member)}</div>
            <div className="truncate text-[11px] text-white/50">
              {member.address}
              {church ? ` · ${church.name}` : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-3 pr-14">
        <div className="pointer-events-auto gis-map-panel w-full max-w-xl px-3 py-3">
          {arrived ? (
            <>
              <div className="text-sm font-semibold text-ok">You are in the visitation zone</div>
              <p className="mt-1 text-xs text-white/60">GPS shows you at the home. Confirm the visit when you are ready.</p>
              <Link href={`/go/${member.id}`} className="btn btn-primary mt-3 w-full">
                Confirm visit
              </Link>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold">{step?.instruction || "Waiting for GPS…"}</div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/60">
                <span className="text-cyan">{formatMeters(remainM)} remaining</span>
                <span>{formatDuration(remainSec)}</span>
                {step && step.distance > 0 && <span>Next: {formatMeters(step.distance)}</span>}
              </div>
              {routeHint && <p className="mt-2 text-xs text-gold">{routeHint}</p>}
              {gpsError && <p className="mt-2 text-xs text-gold">{gpsError}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost py-1.5 text-xs" onClick={() => setFollowing((v) => !v)}>
                  {following ? "Stop following" : "Follow me"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost py-1.5 text-xs"
                  disabled={!fix}
                  onClick={() => fix && void loadRoute(fix, true)}
                >
                  Recalculate
                </button>
                <Link href={`/go/${member.id}`} className="btn btn-cyan py-1.5 text-xs">
                  I’m at the door
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
