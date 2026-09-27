"use client";

import { FormEvent, useState } from "react";
import { useStore } from "@/lib/store";
import type { VisitCategory } from "@/lib/types";
import { formatDateTime, uid } from "@/lib/utils";

export default function SettingsPage() {
  const { user, state, live, updateSettings, upsertCategory, resetDemo, seedLiveCatalog } = useStore();
  const [seedNote, setSeedNote] = useState("");
  const [seeding, setSeeding] = useState(false);
  if (!user) return null;
  if (user.role !== "master_admin") return <p>Only the master administrator can change system settings.</p>;

  function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateSettings({
      organizationName: String(fd.get("organizationName")),
      conferenceName: String(fd.get("conferenceName")),
      divisionName: String(fd.get("divisionName")),
      defaultGeofenceRadius: Number(fd.get("defaultGeofenceRadius")),
      requireGeofence: fd.get("requireGeofence") === "on",
      exceptionRequiresApproval: fd.get("exceptionRequiresApproval") === "on",
      allowTrainingLocation: fd.get("allowTrainingLocation") === "on",
    });
  }

  function addCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const category: VisitCategory = {
      id: uid("cat"),
      name: String(fd.get("name")),
      description: String(fd.get("description")),
      active: true,
      color: "#e400ff",
    };
    upsertCategory(category);
    e.currentTarget.reset();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold">System settings</h1>
      <div className="glass mt-6 rounded-lg p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-cyan">Live directory</div>
        <h2 className="mt-1 text-lg font-semibold">{live ? "Firebase is connected" : "Running on this device only"}</h2>
        <p className="mt-2 text-sm text-white/60">
          {live
            ? "Members, visits, churches and accounts sync to Firestore. Seed the 168 field-GPS churches once so every signed-in device sees the same EZC directory."
            : "Add NEXT_PUBLIC_FIREBASE_API_KEY and APP_ID in .env.local to share one flock across phones and the conference laptop."}
        </p>
        {live ? (
          <button
            type="button"
            className="btn btn-cyan mt-4"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              const result = await seedLiveCatalog();
              setSeeding(false);
              setSeedNote(
                result.ok
                  ? `Seeded ${result.churches || 0} missing churches into the live directory.`
                  : result.error || "Seed failed.",
              );
            }}
          >
            {seeding ? "Seeding…" : "Seed official churches"}
          </button>
        ) : null}
        {seedNote ? <p className="mt-3 text-sm text-ok">{seedNote}</p> : null}
      </div>
      <form className="glass mt-6 grid gap-4 rounded-lg p-6" onSubmit={saveSettings}>
        <input name="organizationName" defaultValue={state.settings.organizationName} />
        <input name="conferenceName" defaultValue={state.settings.conferenceName} />
        <input name="divisionName" defaultValue={state.settings.divisionName} />
        <label className="text-sm text-white/70">
          Default geofence radius (metres)
          <input name="defaultGeofenceRadius" type="number" defaultValue={state.settings.defaultGeofenceRadius} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requireGeofence" defaultChecked={state.settings.requireGeofence} />
          Require geofence for verified visits
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="exceptionRequiresApproval"
            defaultChecked={state.settings.exceptionRequiresApproval}
          />
          Manual visits require administrator approval
        </label>
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              name="allowTrainingLocation"
              defaultChecked={state.settings.allowTrainingLocation}
            />
            <span>
              <span className="block font-semibold text-gold">Train geofence without driving</span>
              <span className="mt-1 block text-white/70">
                When on, pastors see Stand at the door (training) on the visit screen. Confirm unlocks, and the record is
                marked training — not a field GPS lock. Turn this off before live conference use.
              </span>
            </span>
          </label>
        </div>
        <button className="btn btn-primary w-full sm:w-fit">Save settings</button>
      </form>

      <div className="glass mt-6 rounded-lg p-6">
        <h2 className="text-lg font-semibold">Visitation categories</h2>
        <div className="mt-3 grid gap-2">
          {state.categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-white/55">{c.description}</div>
              </div>
              <button className="btn btn-ghost py-1" onClick={() => upsertCategory({ ...c, active: !c.active })}>
                {c.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
        <form className="mt-4 grid gap-2 sm:grid-cols-2" onSubmit={addCategory}>
          <input name="name" placeholder="New category name" required />
          <input name="description" placeholder="Description" required />
          <button className="btn btn-cyan w-fit">Add category</button>
        </form>
      </div>

      <div className="glass mt-6 rounded-lg p-6">
        <h2 className="text-lg font-semibold">Audit trail</h2>
        <div className="mt-3 max-h-80 overflow-auto text-sm scrollbar-thin">
          {state.audit.map((a) => (
            <div key={a.id} className="border-b border-white/8 py-2">
              <span className="text-cyan">{formatDateTime(a.createdAt)}</span> · {a.actorName} · {a.action} · {a.entityType}{" "}
              {a.entityId}
            </div>
          ))}
        </div>
      </div>

      <button
        className="btn btn-danger mt-6"
        onClick={() => {
          if (confirm("Clear this device cache and sign out? Live conference records stay in Firebase.")) resetDemo();
        }}
      >
        Clear this device cache
      </button>
    </div>
  );
}
