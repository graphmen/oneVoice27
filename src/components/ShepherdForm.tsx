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
  const { user, state, live, registerStaff, requestPasswordReset, upsertTerritory } = useStore();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetNote, setResetNote] = useState("");
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState<{ name: string; email: string } | null>(null);
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
    return { churchIds: [...churchIds], selectedTerritories };
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email")).trim().toLowerCase();
    const taken = state.users.some((u) => u.email.toLowerCase() === email && u.id !== account?.id);
    if (taken) {
      setError("That email is already registered.");
      return;
    }
    const password = String(fd.get("password") || "").trim();
    if (!account && live && password.length < 6) {
      setError("Set a sign-in password of at least 6 characters. Give it to them in person or by WhatsApp.");
      return;
    }
    const { churchIds, selectedTerritories } = churchIdsFromPick();
    const next: UserAccount = {
      id: account?.id || uid("usr"),
      email,
      password: password || (!live ? DEMO_PASSWORD : undefined),
      displayName: String(fd.get("displayName")),
      role: String(fd.get("role")) as Role,
      churchIds,
      territoryIds: selectedTerritories,
      phone: String(fd.get("phone") || ""),
      title: String(fd.get("title") || "Pastor"),
      status: (String(fd.get("status") || account?.status || "active") as "active" | "inactive") || "active",
    };
    setBusy(true);
    setError("");
    const result = await registerStaff(next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Could not register this account.");
      return;
    }
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
    if (onSaved) {
      onSaved(next);
      return;
    }
    if (account) {
      router.push("/pastors");
      return;
    }
    setDone({ name: next.displayName, email: next.email });
  }

  if (done) {
    return (
      <div className="glass mt-4 rounded-lg p-5">
        <div className="text-xs uppercase tracking-[0.18em] text-cyan">They can sign in now</div>
        <h2 className="mt-1 text-lg font-semibold">{done.name} is on the directory</h2>
        <p className="mt-2 text-sm text-white/70">
          Give them this email and the password you just set. They open SHEPHERD360, sign in, and see only their
          assigned flock.
        </p>
        <p className="mt-3 rounded-lg bg-white/5 px-4 py-3 font-medium">{done.email}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => router.push("/pastors")}>
            Back to shepherds
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setDone(null)}>
            Register another
          </button>
        </div>
      </div>
    );
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
      <input name="email" type="email" placeholder="Email they will sign in with" required defaultValue={account?.email} />
      <input name="phone" placeholder="Phone" defaultValue={account?.phone} />
      <input name="title" placeholder="Title" defaultValue={account?.title || "District Pastor"} />
      <select name="role" defaultValue={account?.role || "pastor"}>
        <option value="pastor">Pastor</option>
        {user.role !== "pastor" && <option value="church_admin">Church administrator</option>}
      </select>
      {account && (
        <select name="status" defaultValue={account.status}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      )}
      <label className={`text-sm text-white/70 ${account ? "sm:col-span-2" : ""}`}>
        {account
          ? "Create a login if they do not have one yet (leave blank to keep the current sign-in)"
          : "Sign-in password"}
        <input
          className="mt-1"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={account ? undefined : 6}
          required={!account && live}
          placeholder={live ? "At least 6 characters" : DEMO_PASSWORD}
        />
      </label>
      <p className="sm:col-span-2 text-xs text-white/50">
        Assigned to {district?.name || "the selected district"}
        {registeredChurch ? ` · ${registeredChurch.name}` : ""}.{" "}
        {live
          ? "They sign in on the web with this email and password. Church members do not get an account."
          : `Local demo password: ${DEMO_PASSWORD}`}
      </p>
      {error && <p className="sm:col-span-2 text-sm text-rose">{error}</p>}
      {resetNote && <p className="sm:col-span-2 text-sm text-ok">{resetNote}</p>}
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        <button className="btn btn-primary w-full sm:w-fit" disabled={busy}>
          {busy ? "Saving…" : account ? "Save shepherd" : "Register and create login"}
        </button>
        {account && live && (
          <button
            type="button"
            className="btn btn-ghost w-full sm:w-fit"
            disabled={busy || resetting}
            onClick={async () => {
              setResetting(true);
              setError("");
              setResetNote("");
              const result = await requestPasswordReset(account.email);
              setResetting(false);
              if (!result.ok) {
                setError(result.error || "Could not send a reset email.");
                return;
              }
              setResetNote(`Firebase sent a reset link to ${account.email}. They open that inbox and choose a new password.`);
            }}
          >
            {resetting ? "Sending reset…" : "Email a password reset"}
          </button>
        )}
      </div>
    </form>
  );
}
