"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { importRowsToMembers, parseMemberFile, rowsToPreview, type MemberImportPreview } from "@/lib/member-import";
import { canManageMembers } from "@/lib/utils";

export function MemberImport() {
  const { user, state, importMembers } = useStore();
  const [churchId, setChurchId] = useState(user?.churchIds[0] || state.churches[0]?.id || "");
  const [pastorId, setPastorId] = useState("");
  const [preview, setPreview] = useState<MemberImportPreview | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const churches = useMemo(() => {
    if (!user) return [];
    return user.role === "master_admin" ? state.churches : state.churches.filter((c) => user.churchIds.includes(c.id));
  }, [user, state.churches]);
  const pastors = state.users.filter(
    (u) => u.role === "pastor" && u.status === "active" && (user?.role === "master_admin" || u.churchIds.some((id) => user?.churchIds.includes(id))),
  );

  if (!user || !canManageMembers(user)) return null;
  const church = state.churches.find((c) => c.id === churchId);

  async function onFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setNote("");
    try {
      const raw = await parseMemberFile(file);
      setPreview(
        rowsToPreview(raw, {
          defaultChurchId: churchId,
          defaultPastorId: pastorId || undefined,
          churches: state.churches,
          pastors,
        }),
      );
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not read that file.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  function commit() {
    if (!preview?.valid.length || !church) return;
    const members = importRowsToMembers(preview.valid, {
      lat: church.lat,
      lng: church.lng,
      geofenceRadius: state.settings.defaultGeofenceRadius,
    });
    const result = importMembers(members);
    setNote(`Imported ${result.added} members into ${church.name}. Pin homes that still sit on the church GPS.`);
    setPreview(null);
  }

  return (
    <section className="glass mt-4 rounded-lg p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-cyan">Pilot flock</div>
      <h2 className="mt-1 text-lg font-semibold">Import a member roll</h2>
      <p className="mt-2 text-sm text-white/60">
        CSV or Excel with columns such as name, phone, address, church, pastor, frequency. Members without a home pin
        start at the church sanctuary until a shepherd pins the house.{" "}
        <a className="text-cyan" href="/templates/members.csv" download>
          Download a template
        </a>
        .
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-white/55">
          Church
          <select className="mt-1" value={churchId} onChange={(e) => setChurchId(e.target.value)}>
            {churches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-white/55">
          Default shepherd
          <select className="mt-1" value={pastorId} onChange={(e) => setPastorId(e.target.value)}>
            <option value="">Unassigned unless the file names a pastor</option>
            {pastors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        className="mt-3"
        type="file"
        accept=".csv,.txt,.xlsx,.xls"
        disabled={busy}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {preview && (
        <div className="mt-4">
          <p className="text-sm text-white/70">
            {preview.valid.length} ready · {preview.errorCount} need a name or church
          </p>
          <div className="mt-2 max-h-56 overflow-auto text-xs scrollbar-thin">
            {preview.rows.slice(0, 40).map((row, i) => (
              <div key={`${row.firstName}-${row.lastName}-${i}`} className="border-b border-white/8 py-1.5">
                {row.firstName} {row.lastName} · {row.phone || "no phone"} ·{" "}
                {state.churches.find((c) => c.id === row.churchId)?.name || "no church"}
                {row.errors.length ? <span className="text-rose"> · {row.errors.join(", ")}</span> : null}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary mt-3" disabled={!preview.valid.length} onClick={commit}>
            Import {preview.valid.length} members
          </button>
        </div>
      )}
      {note ? <p className="mt-3 text-sm text-ok">{note}</p> : null}
    </section>
  );
}
