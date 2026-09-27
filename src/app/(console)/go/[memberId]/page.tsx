"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRouteParam } from "@/lib/route-id";
import { FormEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { GeofenceRadar } from "@/components/GeofenceRadar";
import { IconChat, IconNav, IconPhone } from "@/components/icons";
import { useStore } from "@/lib/store";
import { insideGeofence, watchGps } from "@/lib/geo";
import type { GpsFix, Visit } from "@/lib/types";
import {
  canEditMember,
  fullName,
  formatLongDate,
  readyVisitMessage,
  telHref,
  uid,
  waHref,
} from "@/lib/utils";

const LeafletTerritoryMap = dynamic(() => import("@/components/gis/LeafletTerritoryMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-white/50">Loading visit map…</div>,
});

export default function GoVisitPage() {
  const memberId = useRouteParam("memberId");
  const { user, state, recordVisit, upsertMember } = useStore();
  const router = useRouter();
  const member = state.members.find((m) => m.id === memberId);
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [pinHint, setPinHint] = useState("");
  const [handPin, setHandPin] = useState(false);
  const [view, setView] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [enteredAt, setEnteredAt] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [confidential, setConfidential] = useState("");
  const [categoryId, setCategoryId] = useState("cat_pastoral");
  const [followUp, setFollowUp] = useState(false);
  const [followUpAt, setFollowUpAt] = useState("");
  const [prayed, setPrayed] = useState(false);
  const [bibleStudy, setBibleStudy] = useState(false);
  const [baptismInterest, setBaptismInterest] = useState(false);
  const [decisionMade, setDecisionMade] = useState(false);
  const [referred, setReferred] = useState(false);
  const [prayer, setPrayer] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [mode, setMode] = useState<"verify" | "exception">("verify");
  const [openedAt] = useState(() => Date.now());
  const [training, setTraining] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (training) return;
    const stop = watchGps(setFix, setGpsError);
    return stop;
  }, [training]);

  const geo = useMemo(() => (fix && member ? insideGeofence(fix, member) : null), [fix, member]);
  const hasFix = Boolean(fix);
  const fitPoints = useMemo(() => {
    if (handPin || !member) return [];
    const pts = [{ lat: member.lat, lng: member.lng }];
    if (fix) pts.push({ lat: fix.lat, lng: fix.lng });
    return pts;
    // First GPS lock, training, or a changed home pin should reframe the map — not every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.lat, member?.lng, hasFix, training, handPin]);

  useEffect(() => {
    if (geo?.inside && !enteredAt) setEnteredAt(new Date().toISOString());
  }, [geo, enteredAt]);

  if (!user || !member) return <p>Member not found.</p>;
  if (user.role !== "pastor") {
    return (
      <p className="text-white/70">
        Visiting belongs to the assigned shepherd. Conference officers watch coverage on{" "}
        <Link href="/dashboard" className="text-cyan">
          M&E
        </Link>
        .
      </p>
    );
  }
  if (member.assignedPastorId !== user.id) {
    return <p>This member is not on your assigned list.</p>;
  }

  const canConfirm = Boolean(geo?.inside);
  const church = state.churches.find((c) => c.id === member.churchId);
  const visitMessage = readyVisitMessage(member.firstName);
  const call = telHref(member.phone);
  const whatsapp = waHref(member.phone, visitMessage);
  const minutes = Math.max(1, Math.round((now - openedAt) / 60_000));
  const seconds = Math.max(0, Math.round((now - openedAt) / 1000) % 60);

  function standAtDoor() {
    if (!member) return;
    setTraining(true);
    setFix({
      lat: member.lat,
      lng: member.lng,
      accuracy: 4,
      timestamp: Date.now(),
    });
    if (!enteredAt) setEnteredAt(new Date().toISOString());
  }

  function pinHomeByHand() {
    if (!user || !member || !view) {
      setPinHint("Zoom the map so the house sits under the crosshair, then pin.");
      return;
    }
    if (!canEditMember(user, member)) {
      setPinHint("Ask an administrator if this home pin should change.");
      return;
    }
    if (view.zoom < 17) {
      setPinHint("Zoom in closer until you can see the house roof, then pin.");
      return;
    }
    upsertMember({
      ...member,
      lat: Number(view.lat.toFixed(6)),
      lng: Number(view.lng.toFixed(6)),
    });
    setPinHint("Home pin moved to the house on the map. This does not confirm the visit.");
    setHandPin(false);
  }

  function pinHomeFromGps() {
    if (!user || !member || !fix) {
      setPinHint("Wait for a GPS reading, then pin.");
      return;
    }
    if (!canEditMember(user, member)) {
      setPinHint("Ask an administrator if this home pin should change.");
      return;
    }
    upsertMember({
      ...member,
      lat: Number(fix.lat.toFixed(6)),
      lng: Number(fix.lng.toFixed(6)),
    });
    setPinHint(`Home geofence updated from GPS (±${Math.round(fix.accuracy)} m).`);
  }

  function submit(e: FormEvent, asException: boolean) {
    e.preventDefault();
    if (!user || !member) return;
    if (asException && !exceptionReason.trim()) {
      setGpsError("Please explain why this visit cannot be GPS-verified.");
      return;
    }
    const existing = state.visits.find(
      (v) => v.memberId === member.id && v.pastorId === user.id && v.status === "scheduled",
    );
    const visit: Visit = {
      id: existing?.id || uid("vis"),
      memberId: member.id,
      pastorId: user.id,
      churchId: member.churchId,
      categoryId,
      status: asException ? "exception_pending" : "completed",
      scheduledAt: existing?.scheduledAt || member.scheduledVisitAt,
      geofenceEnteredAt: enteredAt || undefined,
      completedAt: new Date().toISOString(),
      lat: fix?.lat,
      lng: fix?.lng,
      accuracy: fix?.accuracy,
      locationVerification: asException ? "unverified" : "verified",
      geofenceStatus: geo?.inside ? "entered" : "not_entered",
      adminNotes: notes,
      confidentialNotes: confidential,
      followUpRequired: followUp || Boolean(followUpAt),
      followUpAt: followUpAt || undefined,
      prayerRequest: prayer,
      referralRequired: referred,
      prayed,
      bibleStudy,
      baptismInterest,
      decisionMade,
      referred,
      durationMinutes: Math.max(1, Math.round((Date.now() - (enteredAt ? Date.parse(enteredAt) : openedAt)) / 60_000)),
      exceptionReason: asException ? exceptionReason : undefined,
      trainingOverride: training || undefined,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    recordVisit(visit);
    router.push(`/visits/${visit.id}`);
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">Field visitation</div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{fullName(member)}</h1>
          <p className="text-white/60">
            {member.address} · {church?.name}
            {member.scheduledVisitAt ? ` · booked ${formatLongDate(member.scheduledVisitAt)}` : ""}
          </p>
          <p className="mt-2 text-sm text-cyan">
            Visit duration: {minutes} min {seconds.toString().padStart(2, "0")} s — stored automatically when you confirm.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {call && (
            <a className="btn btn-cyan flex-1 sm:flex-none" href={call}>
              <IconPhone size={16} /> Call
            </a>
          )}
          {whatsapp && (
            <a className="btn btn-cyan flex-1 sm:flex-none" href={whatsapp} target="_blank" rel="noreferrer">
              <IconChat size={16} /> WhatsApp
            </a>
          )}
          <Link href={`/go/${member.id}/navigate`} className="btn btn-ghost flex-1 sm:flex-none">
            <IconNav size={16} /> Navigate
          </Link>
        </div>
      </div>

      {(call || whatsapp) && (
        <p className="mt-3 text-sm text-white/55">
          Ready message: “{visitMessage}”
        </p>
      )}

      <div className="relative mt-4 h-[min(52vh,calc(100dvh-16rem))] min-h-[240px] overflow-hidden rounded-lg border border-white/10 sm:h-[min(72vh,calc(100dvh-11rem))] sm:min-h-[420px]">
        <LeafletTerritoryMap
          territories={state.territories}
          churches={state.churches}
          mode={handPin ? "pin" : "browse"}
          pin={{ lat: member.lat, lng: member.lng }}
          pinRadius={member.geofenceRadius}
          pinLabel={`${fullName(member)} · home`}
          here={handPin ? null : fix ? { lat: fix.lat, lng: fix.lng } : null}
          hereAccuracy={handPin ? undefined : fix?.accuracy}
          fitPoints={fitPoints}
          compactControl
          showCrosshair={handPin}
          baseLayer="hybrid"
          className="h-full w-full rounded-none"
          onViewChange={setView}
        />
        {handPin ? (
          <div className="absolute inset-x-3 bottom-3 z-20 sm:left-1/2 sm:right-auto sm:w-[min(360px,calc(100%-1.5rem))] sm:-translate-x-1/2">
            <div className="gis-map-panel p-3">
              <p className="text-sm text-white/80">
                Zoom onto the house and line it up under the crosshair. You do not need to be there. This only moves the
                geofence — it does not confirm the visit.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn btn-primary flex-1 py-2 text-xs" onClick={pinHomeByHand}>
                  Pin this house
                </button>
                <button type="button" className="btn btn-ghost py-2 text-xs" onClick={() => setHandPin(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute left-3 right-14 top-3 z-20 sm:right-auto sm:w-[min(300px,calc(100%-5.5rem))]">
            <GeofenceRadar
              compact
              member={member}
              fix={fix}
              training={training}
              onTrain={state.settings.allowTrainingLocation !== false ? standAtDoor : undefined}
              onPinHome={canEditMember(user, member) ? pinHomeFromGps : undefined}
              onHandPin={canEditMember(user, member) ? () => setHandPin(true) : undefined}
              durationLabel={`${minutes} min`}
            />
          </div>
        )}
      </div>
      {pinHint && <p className="mt-3 text-sm text-ok">{pinHint}</p>}
      {gpsError && <p className="mt-3 text-sm text-gold">{gpsError} You may still request a manual exception.</p>}
      <p className="mt-2 text-xs text-white/40">
        Magenta pin is the home geofence. Cyan is your GPS. Location is only used while this visit screen is open.
      </p>

      <form className="glass mt-6 rounded-lg p-4 sm:p-6" onSubmit={(e) => e.preventDefault()}>
        <label className="text-sm text-white/70">
          Visitation type
          <select className="mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {state.categories
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label className="mt-4 block text-sm text-white/70">
          Administrative record (visible to authorized administrators)
          <textarea className="mt-1" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="mt-4 block text-sm text-white/70">
          Confidential pastoral notes (assigned pastor and master administrator only)
          <textarea className="mt-1" rows={3} value={confidential} onChange={(e) => setConfidential(e.target.value)} />
        </label>
        <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan">Soul-winning record</div>
          <p className="mt-1 text-sm text-white/50">This is what the conference can audit. Confidential notes stay pastoral.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={prayed} onChange={(e) => setPrayed(e.target.checked)} />
              Prayed with the household
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={bibleStudy} onChange={(e) => setBibleStudy(e.target.checked)} />
              Bible study started or continued
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={baptismInterest} onChange={(e) => setBaptismInterest(e.target.checked)} />
              Baptism interest
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={decisionMade} onChange={(e) => setDecisionMade(e.target.checked)} />
              Decision for Christ / church
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={referred} onChange={(e) => setReferred(e.target.checked)} />
              Referred (health, welfare, or another shepherd)
            </label>
          </div>
        </div>
        <label className="mt-4 block text-sm text-white/70">
          Prayer request
          <input className="mt-1" value={prayer} onChange={(e) => setPrayer(e.target.value)} />
        </label>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
          Follow-up required
        </label>
        {(followUp || followUpAt) && (
          <label className="mt-3 block text-sm text-white/70">
            Follow-up date
            <input className="mt-1" type="date" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
          </label>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className="btn btn-primary w-full sm:w-auto"
            disabled={!canConfirm}
            onClick={(e) => submit(e as unknown as FormEvent, false)}
          >
            Confirm visitation
          </button>
          <button
            type="button"
            className="btn btn-ghost w-full sm:w-auto"
            onClick={() => setMode((m) => (m === "exception" ? "verify" : "exception"))}
          >
            Request manual verification
          </button>
          <Link href={`/members/${member.id}`} className="btn btn-ghost w-full sm:w-auto">
            Cancel
          </Link>
        </div>
        {!canConfirm && (
          <p className="mt-3 text-sm text-white/55">
            Confirm stays locked until GPS shows you inside the {member.geofenceRadius} m zone
            {state.settings.allowTrainingLocation !== false
              ? ", or tap Stand at the door (training) if you are practising without driving."
              : "."}{" "}
            This prevents a drive-by from counting as a pastoral visit.
          </p>
        )}
        {mode === "exception" && (
          <div className="mt-4">
            <label className="text-sm text-white/70">
              Why should this visit be recorded without geofence verification?
              <textarea
                className="mt-1"
                rows={3}
                required
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                placeholder="Hospital, member relocated, poor GPS, emergency…"
              />
            </label>
            <button type="button" className="btn btn-cyan mt-3 w-full sm:w-auto" onClick={(e) => submit(e as unknown as FormEvent, true)}>
              Submit exception for approval
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
