"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { HierarchyPicker, type HierarchyPick } from "@/components/HierarchyPicker";
import { HomePinPicker } from "@/components/HomePinPicker";
import { useStore } from "@/lib/store";
import { containingTerritories, LEVEL_LABEL } from "@/lib/gis";
import { EZC_CONFERENCE_ID } from "@/lib/constants";
import type { Member, MemberType, VisitFrequency } from "@/lib/types";
import { canAssignPastor, computeNextDue, uid } from "@/lib/utils";
import { demoLinks } from "@/lib/ezc-index";

export function MemberForm({
  member,
  defaultChurchId,
  placement,
  onPlacementChange,
  hidePlacement = false,
  onSaved,
}: {
  member?: Member;
  defaultChurchId?: string;
  placement?: HierarchyPick;
  onPlacementChange?: (next: HierarchyPick) => void;
  hidePlacement?: boolean;
  onSaved?: (id: string) => void;
}) {
  const { user, state, upsertMember } = useStore();
  const router = useRouter();
  const [error, setError] = useState("");
  const [lat, setLat] = useState<number | "">(member?.lat ?? "");
  const [lng, setLng] = useState<number | "">(member?.lng ?? "");
  const [radius, setRadius] = useState(member?.geofenceRadius ?? state.settings.defaultGeofenceRadius);
  const [address, setAddress] = useState(member?.address ?? "");
  const seedChurch = state.churches.find((c) => c.id === (member?.churchId || defaultChurchId || placement?.churchId));
  const [localPick, setLocalPick] = useState<HierarchyPick>({
    conferenceId: EZC_CONFERENCE_ID,
    districtId: placement?.districtId || seedChurch?.districtId || demoLinks.harareCentralDistrictId,
    churchTerritoryId: placement?.churchTerritoryId || seedChurch?.territoryId,
    churchId: placement?.churchId || seedChurch?.id,
  });
  const pick = placement || localPick;
  const setPick = onPlacementChange || setLocalPick;

  if (!user) return null;
  const pastors = state.users.filter(
    (u) => u.role === "pastor" && (user.role === "master_admin" || u.churchIds.some((id) => user.churchIds.includes(id))),
  );
  const assignPastor = canAssignPastor(user);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const churchId = pick.churchId || String(fd.get("churchId"));
    if (!churchId) {
      setError("Place this member on a registered church in the hierarchy.");
      return;
    }
    if (typeof lat !== "number" || typeof lng !== "number") {
      setError("Pin the home on the map or capture GPS before saving.");
      return;
    }
    const freq = String(fd.get("visitationFrequency")) as VisitFrequency;
    const assignedPastorId = assignPastor
      ? String(fd.get("assignedPastorId") || "") || undefined
      : member?.assignedPastorId || user?.id;
    const next: Member = {
      id: member?.id || uid("mem"),
      firstName: String(fd.get("firstName")),
      lastName: String(fd.get("lastName")),
      churchId,
      assignedPastorId,
      phone: String(fd.get("phone") || ""),
      email: String(fd.get("email") || ""),
      address: String(fd.get("address")),
      suburb: String(fd.get("suburb") || ""),
      lat,
      lng,
      geofenceRadius: radius,
      visitationFrequency: freq,
      lastVisitAt: member?.lastVisitAt,
      nextVisitDue: member?.nextVisitDue || computeNextDue(undefined, freq),
      memberType: String(fd.get("memberType")) as MemberType,
      adminNotes: String(fd.get("adminNotes") || ""),
      status: "active",
      createdAt: member?.createdAt || new Date().toISOString(),
    };
    upsertMember(next);
    if (onSaved) onSaved(next.id);
    else router.push(`/members/${next.id}`);
  }

  return (
    <form className="glass mt-6 grid gap-4 rounded-lg p-6" onSubmit={onSubmit}>
      <div className="rounded-lg border border-cyan/30 bg-cyan/5 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-cyan">Pin the home — this is the geofence</div>
        <p className="mt-2 text-sm text-white/70">
          Search the street, or stand at the door and tap Pin my GPS. Confirmations later use this pin.
        </p>
        <div className="mt-4">
          <HomePinPicker
            lat={lat}
            lng={lng}
            radius={radius}
            onChange={(coords) => {
              setLat(coords.lat);
              setLng(coords.lng);
              if (coords.label && !address) setAddress(coords.label);
              const inside = containingTerritories(state.territories, coords.lat, coords.lng);
              const district = inside.find((t) => t.level === "district");
              const churchTer = inside.find((t) => t.level === "church");
              if (district || churchTer) {
                setPick({
                  conferenceId: EZC_CONFERENCE_ID,
                  districtId: district?.id || pick.districtId,
                  churchTerritoryId: churchTer?.id,
                  churchId: churchTer?.churchId || state.churches.find((c) => c.territoryId === churchTer?.id)?.id,
                });
              }
            }}
          />
        </div>
        <label className="mt-4 block text-sm text-white/70">
          Geofence (metres)
          <input
            className="mt-1"
            type="number"
            value={radius}
            min={20}
            max={500}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
        </label>
        {typeof lat === "number" && typeof lng === "number" && (
          <p className="mt-3 text-sm text-white/70">
            GIS hierarchy at this home:{" "}
            {containingTerritories(state.territories, lat, lng)
              .map((t) => `${LEVEL_LABEL[t.level]} (${t.shortName || t.name})`)
              .join(" → ") || "outside a drawn district — assign church below"}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="firstName" label="First name" required defaultValue={member?.firstName} />
        <Field name="lastName" label="Last name" required defaultValue={member?.lastName} />
        <Field name="phone" label="Phone" defaultValue={member?.phone} />
        <Field name="email" label="Email" type="email" defaultValue={member?.email} />
      </div>
      <label className="text-sm text-white/70">
        Residential address
        <input className="mt-1" name="address" required value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <Field name="suburb" label="Suburb / area" defaultValue={member?.suburb} />
      {!hidePlacement && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan">Place on the SDA hierarchy</div>
          <p className="mt-1 text-sm text-white/55">District and church this member belongs to.</p>
          <div className="mt-3">
            <HierarchyPicker value={pick} onChange={setPick} leaf="church" showGisChurches={false} />
          </div>
        </div>
      )}
      <input type="hidden" name="churchId" value={pick.churchId || ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        {assignPastor ? (
          <label className="text-sm text-white/70">
            Assigned pastor
            <select name="assignedPastorId" className="mt-1" defaultValue={member?.assignedPastorId || ""}>
              <option value="">Unassigned</option>
              {pastors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="self-end text-sm text-white/55">
            Assigned pastor stays {user.displayName}. Church administrators change shepherd assignments.
          </p>
        )}
        <label className="text-sm text-white/70">
          Member type
          <select name="memberType" className="mt-1" defaultValue={member?.memberType || "regular"}>
            <option value="regular">Regular</option>
            <option value="new">New member</option>
            <option value="followup">Follow-up</option>
            <option value="crisis">Crisis</option>
            <option value="inactive">Inactive / digital interest</option>
          </select>
        </label>
        <label className="text-sm text-white/70">
          Visitation frequency
          <select name="visitationFrequency" className="mt-1" defaultValue={member?.visitationFrequency || "quarterly"}>
            <option value="monthly">Monthly</option>
            <option value="bimonthly">Every 2 months</option>
            <option value="quarterly">Quarterly</option>
            <option value="biannually">Biannually</option>
            <option value="annually">Annually</option>
          </select>
        </label>
      </div>
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
      <label className="text-sm text-white/70">
        Administrative notes
        <textarea name="adminNotes" rows={3} className="mt-1" defaultValue={member?.adminNotes} />
      </label>
      {error && <p className="text-rose">{error}</p>}
      <button className="btn btn-primary w-full sm:w-fit">{member ? "Save changes" : "Save member & geofence"}</button>
    </form>
  );
}

function Field({
  name,
  label,
  required,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="text-sm text-white/70">
      {label}
      <input className="mt-1" name={name} type={type} required={required} defaultValue={defaultValue} />
    </label>
  );
}
