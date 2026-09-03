"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { HierarchyPicker, type HierarchyPick } from "@/components/HierarchyPicker";
import { useStore } from "@/lib/store";
import { DEMO_PASSWORD, EZC_CONFERENCE_ID } from "@/lib/constants";
import { demoLinks } from "@/lib/ezc-index";
import type { Role, UserAccount } from "@/lib/types";
import { uid } from "@/lib/utils";

export function ShepherdForm({
  account,
  pick: controlledPick,
  onPickChange,
  hidePlacement = false,
  onSaved,
}: {
  account?: UserAccount;
  pick?: HierarchyPick;
  onPickChange?: (next: HierarchyPick) => void;
  hidePlacement?: boolean;
  onSaved?: (account: UserAccount) => void;
}) {
  const { user, state, upsertUser, upsertTerritory } = useStore();
  const router = useRouter();
  const [error, setError] = useState("");
  const [localPick, setLocalPick] = useState<HierarchyPick>({
    conferenceId: EZC_CONFERENCE_ID,
    districtId: account?.territoryIds?.find((id) => state.territories.find((t) => t.id === id && t.level === "district"))
      || demoLinks.harareCentralDistrictId,
    churchTerritoryId: account?.territoryIds?.find((id) => state.territories.find((t) => t.id === id && t.level === "church")),
    churchId: account?.churchIds[0],
  });
  const pick = controlledPick || localPick;
  const setPick = onPickChange || setLocalPick;
  const district = state.territories.find((t) => t.id === pick.districtId);
  const registeredChurch = state.churches.find((c) => c.id === pick.churchId);

  if (!user) return null;

  function churchIdsFromPick() {
    const churchId = pick.churchId || "";
    const selectedTerritories = [pick.districtId, pick.churchTerritoryId].filter(Boolean) as string[];
    const fromDistricts = state.territories.filter((t) => selectedTerritories.includes(t.id));
    const churchIds = new Set<string>(churchId ? [churchId] : account?.churchIds || []);
    for (const t of fromDistricts) {
      if (t.churchId) churchIds.add(t.churchId);
      state.churches.filter((c) => c.districtId === t.id).forEach((c) => churchIds.add(c.id));
    }
    return { churchIds: [...churchIds], selectedTerritories, fromDistricts };
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email")).trim().toLowerCase();
    const taken = state.users.some((u) => u.email.toLowerCase() === email && u.id !== account?.id);
    if (taken) {
      setError("That email is already registered.");
      return;
    }
    const { churchIds, selectedTerritories } = churchIdsFromPick();
    const password = String(fd.get("password") || "").trim();
    const next: UserAccount = {
      id: account?.id || uid("usr"),
      email,
      password: password || account?.password || DEMO_PASSWORD,
      displayName: String(fd.get("displayName")),
      role: String(fd.get("role")) as Role,
      churchIds,
      territoryIds: selectedTerritories,
      phone: String(fd.get("phone") || ""),
      title: String(fd.get("title") || "Pastor"),
      status: (String(fd.get("status") || account?.status || "active") as "active" | "inactive") || "active",
    };
    upsertUser(next);
    const previous = new Set(account?.territoryIds || []);
    for (const t of state.territories) {
      const shouldHave = selectedTerritories.includes(t.id);
      const has = t.assignedPastorIds.includes(next.id);
      if (shouldHave && !has) {
        upsertTerritory({ ...t, assignedPastorIds: [...t.assignedPastorIds, next.id] });
      } else if (!shouldHave && has && previous.has(t.id)) {
        upsertTerritory({ ...t, assignedPastorIds: t.assignedPastorIds.filter((id) => id !== next.id) });
      }
    }
    if (onSaved) onSaved(next);
    else router.push("/pastors");
  }

  return (
    <form className="glass mt-4 grid gap-3 rounded-lg p-5 sm:grid-cols-2" onSubmit={onSubmit}>
      {!hidePlacement && (
        <div className="sm:col-span-2 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan">Place in EZC</div>
          <div className="mt-3">
            <HierarchyPicker value={pick} onChange={setPick} leaf="church" />
          </div>
        </div>
      )}
      <input name="displayName" placeholder="Full name" required defaultValue={account?.displayName} />
      <input name="email" type="email" placeholder="Email" required defaultValue={account?.email} />
      <input name="phone" placeholder="Phone" defaultValue={account?.phone} />
      <input name="title" placeholder="Title" defaultValue={account?.title || "District Pastor"} />
      <select name="role" defaultValue={account?.role || "pastor"} className={account ? "" : "sm:col-span-2"}>
        <option value="pastor">Pastor</option>
        {user.role === "master_admin" && <option value="church_admin">Church administrator</option>}
      </select>
      {account && (
        <select name="status" defaultValue={account.status}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      )}
      {account && (
        <label className="sm:col-span-2 text-sm text-white/70">
          New password (leave blank to keep current)
          <input className="mt-1" name="password" type="password" autoComplete="new-password" />
        </label>
      )}
      <p className="sm:col-span-2 text-xs text-white/50">
        Assigned to {district?.name || "the selected district"}
        {registeredChurch ? ` · ${registeredChurch.name}` : ""}.
        {!account ? ` Sign-in password: ${DEMO_PASSWORD}` : ""}
      </p>
      {error && <p className="sm:col-span-2 text-sm text-rose">{error}</p>}
      <button className="btn btn-primary w-full sm:w-fit">{account ? "Save shepherd" : "Register shepherd"}</button>
    </form>
  );
}
