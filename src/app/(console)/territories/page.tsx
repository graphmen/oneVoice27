"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GisPinPicker } from "@/components/gis/GisPinPicker";
import { HierarchyPicker, type HierarchyPick } from "@/components/HierarchyPicker";
import { MemberForm } from "@/components/MemberForm";
import { useStore } from "@/lib/store";
import { circlePolygon } from "@/lib/gis";
import { DEMO_PASSWORD, EZC_CONFERENCE_ID } from "@/lib/constants";
import { demoLinks } from "@/lib/ezc-index";
import type { Church, Role, Territory, UserAccount } from "@/lib/types";
import { canEditGis, canRegisterMembers, uid } from "@/lib/utils";

type DeskTab = "church" | "shepherd" | "member";

function RegisterInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, state, upsertChurch, upsertTerritory, upsertUser } = useStore();
  const requested = (params.get("type") as DeskTab) || "member";
  const [tab, setTab] = useState<DeskTab>(requested);
  const [done, setDone] = useState("");
  const [memberFormKey, setMemberFormKey] = useState(0);
  const [lat, setLat] = useState<number | "">("");
  const [lng, setLng] = useState<number | "">("");
  const [pick, setPick] = useState<HierarchyPick>({
    conferenceId: EZC_CONFERENCE_ID,
    districtId: params.get("district") || demoLinks.harareCentralDistrictId,
    churchTerritoryId: params.get("territory") || undefined,
    churchId: params.get("church") || "ch_central",
  });

  const canPlaceChurch = Boolean(user && canEditGis(user));
  const canPlaceMember = Boolean(user && canRegisterMembers(user));
  const tabs = useMemo(() => {
    const all: { id: DeskTab; label: string }[] = [];
    if (canPlaceChurch) {
      all.push({ id: "church", label: "Church" });
      all.push({ id: "shepherd", label: "Shepherd" });
    }
    if (canPlaceMember) all.push({ id: "member", label: "Member" });
    return all;
  }, [canPlaceChurch, canPlaceMember]);

  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id || "member";
  const district = state.territories.find((t) => t.id === pick.districtId);
  const mappedChurch = state.territories.find((t) => t.id === pick.churchTerritoryId);
  const registeredChurch = state.churches.find((c) => c.id === pick.churchId);

  useEffect(() => {
    if (requested === "church" || requested === "shepherd" || requested === "member") setTab(requested);
  }, [requested]);

  function openTab(next: DeskTab) {
    setTab(next);
    setDone("");
    const query = new URLSearchParams(params.toString());
    query.set("type", next);
    router.replace(`/territories?${query.toString()}`);
  }

  function saveChurch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !canPlaceChurch) return;
    if (typeof lat !== "number" || typeof lng !== "number") return;
    const fd = new FormData(e.currentTarget);
    const churchId = uid("ch");
    const existing = state.territories.find((t) => t.id === pick.churchTerritoryId && t.level === "church");
    const territoryId = existing?.id || uid("ter");
    const name = String(fd.get("name"));
    const church: Church = {
      id: churchId,
      name,
      regionId: state.regions[0]?.id || "reg_harare",
      districtId: pick.districtId,
      territoryId,
      address: String(fd.get("address")),
      city: String(fd.get("city")),
      lat,
      lng,
    };
    upsertChurch(church);
    if (existing) {
      upsertTerritory({ ...existing, churchId, name: existing.name || name, parentId: pick.districtId });
    } else {
      const territory: Territory = {
        id: territoryId,
        name,
        level: "church",
        parentId: pick.districtId,
        churchId,
        color: "#5dffb2",
        assignedPastorIds: [],
        geometry: circlePolygon(lat, lng, 1200),
        notes: "Catchment started as a 1.2 km ring around the sanctuary. Draw the true boundary in GIS.",
      };
      upsertTerritory(territory);
    }
    setPick((cur) => ({ ...cur, churchId, churchTerritoryId: territoryId }));
    const savedName = name;
    const savedDistrict = district?.name || "this district";
    const query = new URLSearchParams(params.toString());
    query.set("type", "member");
    setTab("member");
    router.replace(`/territories?${query.toString()}`);
    setLat("");
    setLng("");
    setDone(`${savedName} is registered in ${savedDistrict}. You can add a shepherd or members next.`);
  }

  function saveShepherd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !canPlaceChurch) return;
    const fd = new FormData(e.currentTarget);
    const churchId = pick.churchId || "";
    const selectedTerritories = [pick.districtId, pick.churchTerritoryId].filter(Boolean) as string[];
    const fromDistricts = state.territories.filter((t) => selectedTerritories.includes(t.id));
    const churchIds = new Set<string>(churchId ? [churchId] : []);
    for (const t of fromDistricts) {
      if (t.churchId) churchIds.add(t.churchId);
      state.churches.filter((c) => c.districtId === t.id).forEach((c) => churchIds.add(c.id));
    }
    const account: UserAccount = {
      id: uid("usr"),
      email: String(fd.get("email")),
      password: DEMO_PASSWORD,
      displayName: String(fd.get("displayName")),
      role: String(fd.get("role")) as Role,
      churchIds: [...churchIds],
      territoryIds: selectedTerritories,
      phone: String(fd.get("phone") || ""),
      title: String(fd.get("title") || "Pastor"),
      status: "active",
    };
    upsertUser(account);
    for (const t of fromDistricts) {
      if (!t.assignedPastorIds.includes(account.id)) {
        upsertTerritory({ ...t, assignedPastorIds: [...t.assignedPastorIds, account.id] });
      }
    }
    setDone(`${account.displayName} is registered over ${district?.name || "this district"}. Sign-in password: ${DEMO_PASSWORD}`);
    e.currentTarget.reset();
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold">Register</h1>
      <p className="mt-2 text-white/60">
        Choose the place in the SDA hierarchy, then save the church, shepherd or member here. GIS is only for
        boundaries.
      </p>

      <div className="glass mt-6 grid gap-4 rounded-lg p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan">Place in EZC</div>
        <HierarchyPicker value={pick} onChange={setPick} leaf="church" />
        <p className="text-sm text-white/50">
          {registeredChurch
            ? `Records will sit under ${registeredChurch.name}.`
            : mappedChurch
              ? `${mappedChurch.name} is mapped. Register that congregation first if you need members there.`
              : `District ${district?.name || "—"}. Register a church here to add members.`}
        </p>
      </div>

      <div className="mt-4 tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={active === t.id ? "tab tab-on" : "tab"}
            onClick={() => openTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {done && <p className="mt-4 text-sm text-ok">{done}</p>}

      {active === "church" && canPlaceChurch && (
        <form className="glass mt-4 grid gap-3 rounded-lg p-5" onSubmit={saveChurch}>
          <h2 className="text-lg font-semibold">Register a church</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="name" placeholder="Church name" required defaultValue={mappedChurch?.name || ""} />
            <input name="city" placeholder="City" required />
            <input name="address" placeholder="Sanctuary address" className="sm:col-span-2" required />
          </div>
          <GisPinPicker
            lat={lat}
            lng={lng}
            onChange={(coords) => {
              setLat(coords.lat);
              setLng(coords.lng);
              if (coords.districtId) {
                setPick((cur) => ({
                  ...cur,
                  districtId: coords.districtId || cur.districtId,
                  churchTerritoryId: coords.territoryId || cur.churchTerritoryId,
                }));
              }
            }}
          />
          <button className="btn btn-primary w-fit" disabled={typeof lat !== "number"}>
            Save church
          </button>
        </form>
      )}

      {active === "shepherd" && canPlaceChurch && (
        <form className="glass mt-4 grid gap-3 rounded-lg p-5 sm:grid-cols-2" onSubmit={saveShepherd}>
          <h2 className="sm:col-span-2 text-lg font-semibold">Register a shepherd</h2>
          <input name="displayName" placeholder="Full name" required />
          <input name="email" type="email" placeholder="Email" required />
          <input name="phone" placeholder="Phone" />
          <input name="title" placeholder="Title" defaultValue="District Pastor" />
          <select name="role" defaultValue="pastor" className="sm:col-span-2">
            <option value="pastor">Pastor</option>
            {user.role === "master_admin" && <option value="church_admin">Church administrator</option>}
          </select>
          <p className="sm:col-span-2 text-xs text-white/50">
            Assigned to {district?.name || "the selected district"}
            {registeredChurch ? ` · ${registeredChurch.name}` : ""}. Demo password: {DEMO_PASSWORD}
          </p>
          <button className="btn btn-primary w-fit">Save shepherd</button>
        </form>
      )}

      {active === "member" && canPlaceMember && (
        <div className="mt-4">
          {!pick.churchId ? (
            <p className="glass rounded-lg p-5 text-sm text-gold">
              Pick a registered congregation above, or open the Church tab and save one first.
            </p>
          ) : (
            <div>
              <h2 className="text-lg font-semibold">Register a member</h2>
              <MemberForm
                key={memberFormKey}
                defaultChurchId={pick.churchId}
                placement={pick}
                onPlacementChange={setPick}
                hidePlacement
                onSaved={() => {
                  setDone("Member saved with a home pin. You can register another in this church.");
                  setMemberFormKey((n) => n + 1);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="text-white/60">Opening registration…</p>}>
      <RegisterInner />
    </Suspense>
  );
}
