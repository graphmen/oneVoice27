"use client";

import { insideGeofence } from "@/lib/geo";
import type { GpsFix, Member } from "@/lib/types";
import { cx } from "@/lib/utils";

export function GeofenceRadar({
  member,
  fix,
  training,
  onTrain,
  onPinHome,
  durationLabel,
  compact = false,
}: {
  member: Member;
  fix: GpsFix | null;
  training?: boolean;
  onTrain?: () => void;
  onPinHome?: () => void;
  durationLabel?: string;
  compact?: boolean;
}) {
  const result = fix ? insideGeofence(fix, member) : null;
  const ratio = result ? Math.min(result.distance / Math.max(member.geofenceRadius, 1), 2.2) : 1.4;
  const blip = Math.min(42, ratio * 28);

  return (
    <div className={cx("gis-map-panel overflow-hidden", compact ? "p-3" : "glass rounded-lg p-5")}>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Geofence verification</div>
          <div className={cx("mt-1 font-semibold", compact ? "text-base" : "text-lg")}>
            {result
              ? result.inside
                ? "You are in the visitation zone"
                : `${Math.round(result.distance)} m from home`
              : "Waiting for GPS…"}
          </div>
        </div>
        <div className={cx("badge shrink-0", result?.inside ? "bg-ok/15 text-ok" : "bg-white/10 text-white/70")}>
          {result?.inside ? "Entered" : "Outside"}
        </div>
      </div>
      {!compact && (
        <div className="radar relative mx-auto grid h-64 w-64 place-items-center rounded-full border border-magenta/40">
          <div className="absolute rounded-full border border-cyan/50" style={{ width: "46%", height: "46%" }} />
          <div className="absolute h-3 w-3 rounded-full bg-cyan shadow-[0_0_16px_#9eecff]" />
          {fix && (
            <div
              className={cx("absolute h-3 w-3 rounded-full", result?.inside ? "bg-ok" : "bg-magenta")}
              style={{
                transform: `translateY(-${blip}px)`,
                boxShadow: result?.inside ? "0 0 16px #5dffb2" : "0 0 16px #e400ff",
              }}
            />
          )}
        </div>
      )}
      <div className={cx("grid grid-cols-3 gap-3 text-center text-xs text-white/65", !compact && "mt-4")}>
        <div>
          <div className="text-white">Radius</div>
          {member.geofenceRadius} m
        </div>
        <div>
          <div className="text-white">Distance</div>
          {result ? `${Math.round(result.distance)} m` : "—"}
        </div>
        <div>
          <div className="text-white">Accuracy</div>
          {fix ? `${Math.round(fix.accuracy)} m` : "—"}
        </div>
      </div>
      {!compact && (
        <p className="mt-4 text-xs leading-relaxed text-white/50">
          Location is only used while this visit screen is open. SHEPHERD360 verifies a visit — it does not track
          shepherds throughout the day.
        </p>
      )}
      {durationLabel && <p className="mt-3 text-sm text-cyan">Time on this visit: {durationLabel}</p>}
      {onTrain && (
        <button type="button" className={cx("btn btn-cyan mt-3 w-full", compact && "py-2 text-xs")} onClick={onTrain}>
          {training ? "Training pin is on — confirm below" : "Stand at the door (training)"}
        </button>
      )}
      {onPinHome && (
        <button
          type="button"
          className={cx("btn btn-ghost mt-2 w-full", compact && "py-2 text-xs")}
          onClick={onPinHome}
          disabled={!fix}
        >
          Pin this home from my GPS
        </button>
      )}
      {training && (
        <p className="mt-2 text-xs text-gold">This will be saved as a training override, not a field GPS lock.</p>
      )}
    </div>
  );
}
