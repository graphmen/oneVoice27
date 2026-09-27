"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChurchForm } from "@/components/ChurchForm";
import { HierarchyPicker, type HierarchyPick } from "@/components/HierarchyPicker";
import { MemberForm } from "@/components/MemberForm";
import { ShepherdForm } from "@/components/ShepherdForm";
import { useStore } from "@/lib/store";
import { EZC_CONFERENCE_ID } from "@/lib/constants";
import { demoLinks } from "@/lib/ezc-index";
import { canEditGis, canRegisterMembers } from "@/lib/utils";

type DeskTab = "church" | "shepherd" | "member";

function RegisterInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, state } = useStore();
  const requested = (params.get("type") as DeskTab) || "member";
  const [tab, setTab] = useState<DeskTab>(requested);
  const [done, setDone] = useState("");
  const [memberFormKey, setMemberFormKey] = useState(0);
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

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold">Register</h1>
      <p className="mt-2 text-white/60">
        Choose the place in the SDA hierarchy, then save the church, shepherd or member here. GIS is only for
        boundaries. Existing records can be edited or deleted from Churches, Shepherds, or Members.
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
        <div className="mt-2">
          <h2 className="text-lg font-semibold">Register a church</h2>
          <ChurchForm
            pick={pick}
            onPickChange={setPick}
            hidePlacement
            defaultName={mappedChurch?.name}
            onSaved={(church) => {
              setPick((cur) => ({ ...cur, churchId: church.id, churchTerritoryId: church.territoryId }));
              const query = new URLSearchParams(params.toString());
              query.set("type", "member");
              setTab("member");
              router.replace(`/territories?${query.toString()}`);
              setDone(
                `${church.name} is registered in ${district?.name || "this district"}. You can add a shepherd or members next.`,
              );
            }}
          />
        </div>
      )}

      {active === "shepherd" && canPlaceChurch && (
        <div className="mt-2">
          <h2 className="text-lg font-semibold">Register a shepherd</h2>
          <ShepherdForm
            pick={pick}
            onPickChange={setPick}
            hidePlacement
            onSaved={(account) => {
              setDone(
                `${account.displayName} is registered over ${district?.name || "this district"}. Give them their email and the password you set — they can sign in on the web now.`,
              );
            }}
          />
        </div>
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
