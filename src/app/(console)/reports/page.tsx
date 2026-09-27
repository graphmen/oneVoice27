"use client";

import { useMemo, useState } from "react";
import { EvaluationLegend, ShepherdPerformanceMatrix } from "@/components/ShepherdMatrix";
import { useStore } from "@/lib/store";
import { CONFERENCE_SHORT, SYSTEM_NAME } from "@/lib/constants";
import {
  DUTY_LABEL,
  fieldCareVisits,
  fruitCounts,
  shepherdMonitorRows,
  verifiedFieldVisits,
  verifiedRate,
} from "@/lib/care";
import { downloadCsv, fullName, isOverdue, visibleMembers, visibleVisits } from "@/lib/utils";

export default function ReportsPage() {
  const { user, state } = useStore();
  const [churchId, setChurchId] = useState("all");
  if (!user) return null;

  const members = visibleMembers(user, state.members).filter((m) => churchId === "all" || m.churchId === churchId);
  const visits = visibleVisits(user, state.visits, state.members).filter(
    (v) => churchId === "all" || v.churchId === churchId,
  );
  const completed = fieldCareVisits(visits);
  const verified = verifiedFieldVisits(visits);
  const training = visits.filter((v) => v.trainingOverride && (v.status === "completed" || v.status === "exception_approved"));
  const fruit = fruitCounts(visits);
  const overdue = members.filter((m) => isOverdue(m));
  const rows = shepherdMonitorRows(user, members, visits, state.churches, state.territories, state.users).filter(
    (row) => churchId === "all" || row.pastor.churchIds.includes(churchId),
  );
  const churches = state.churches.filter((c) => user.role === "master_admin" || user.churchIds.includes(c.id));
  const churchName = churchId === "all" ? "All churches" : churches.find((c) => c.id === churchId)?.name || "All churches";
  const generated = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const byCategory = useMemo(() => {
    return state.categories.map((c) => ({
      name: c.name,
      count: completed.filter((v) => v.categoryId === c.id).length,
    }));
  }, [state.categories, completed]);

  function exportReport() {
    downloadCsv("shepherd360-pastor-performance.csv", [
      ["Metric", "Value"],
      ["Members", String(members.length)],
      ["Field visits (training excluded)", String(completed.length)],
      ["GPS verified", String(verified.length)],
      ["Verified rate", `${verifiedRate(visits)}%`],
      ["Training excluded", String(training.length)],
      ["Bible studies", String(fruit.bibleStudy)],
      ["Baptism interest", String(fruit.baptismInterest)],
      ["Decisions", String(fruit.decisionMade)],
      ["Overdue", String(overdue.length)],
      [],
      [
        "Pastor",
        "Rating",
        "Why",
        "District",
        "Church",
        "Assigned",
        "Overdue",
        "Coverage %",
        "GPS verified visits",
        "Field visits",
        "Verified %",
        "Bible studies",
        "Baptism interest",
        "Decisions",
        "Prayed",
        "Last field visit",
      ],
      ...rows.map((row) => [
        row.pastor.displayName,
        DUTY_LABEL[row.duty],
        row.reason,
        row.districtName,
        row.churchName,
        String(row.assigned),
        String(row.overdue),
        String(row.coverage),
        String(row.verified),
        String(row.fieldVisits),
        String(row.verifiedPct),
        String(row.bibleStudy),
        String(row.baptismInterest),
        String(row.decisionMade),
        String(row.prayed),
        row.lastVisitAt || "",
      ]),
    ]);
  }

  const kpis = [
    { label: "Members", value: members.length, hint: churchName },
    { label: "Field visits", value: completed.length, hint: `${training.length} training excluded` },
    { label: "GPS verified", value: verified.length, hint: `${verifiedRate(visits)}% of field visits` },
    { label: "Bible studies", value: fruit.bibleStudy, hint: `${fruit.baptismInterest} baptism interest` },
    { label: "Overdue care", value: overdue.length, hint: "Households past due" },
  ];

  return (
    <div className="report-page mx-auto max-w-6xl">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Reports</h1>
          <p className="mt-1 text-white/60">
            Conference board copy: flock coverage, GPS presence, and fruit by shepherd. Training visits are excluded
            from field counts.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <select className="w-full sm:w-auto" value={churchId} onChange={(e) => setChurchId(e.target.value)}>
            <option value="all">All churches</option>
            {churches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button className="btn btn-ghost flex-1 sm:flex-none" onClick={exportReport}>
              Export CSV
            </button>
            <button className="btn btn-cyan flex-1 sm:flex-none" onClick={() => window.print()}>
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      <div className="report-sheet mt-5 rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6">
        <header className="border-b border-white/10 pb-4">
          <div className="text-xs uppercase tracking-[0.16em] text-cyan">
            {state.settings.conferenceName || CONFERENCE_SHORT} · SHEPHERD360
          </div>
          <h2 className="mt-1 text-2xl font-semibold">Pastoral visitation report</h2>
          <p className="mt-1 text-sm text-white/60">
            {churchName} · Generated {generated}
          </p>
          <p className="mt-2 hidden text-xs text-white/45 print:block">{SYSTEM_NAME}</p>
        </header>

        <div className="report-kpis mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-white/10 bg-[#12001c]/40 px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{kpi.label}</div>
              <div className="mt-1 text-2xl font-semibold">{kpi.value}</div>
              <div className="mt-1 text-xs text-white/45">{kpi.hint}</div>
            </div>
          ))}
        </div>

        <section className="mt-6">
          <h3 className="text-lg font-semibold">Shepherd performance</h3>
          <p className="no-print mt-1 text-sm text-white/50">
            Same ratings as Monitor. Export CSV for the board, or print this sheet for a paper copy.
          </p>
          <EvaluationLegend />
          <ShepherdPerformanceMatrix rows={rows} />
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-white/10 p-4">
            <h3 className="font-semibold">Visits by category</h3>
            <div className="mt-3 grid gap-2">
              {byCategory.length === 0 ? (
                <p className="text-sm text-white/50">No field visits in this view yet.</p>
              ) : (
                byCategory.map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-3 text-sm">
                    <span>{c.name}</span>
                    <span className="font-medium text-cyan">{c.count}</span>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="rounded-lg border border-white/10 p-4">
            <h3 className="font-semibold">Members still waiting</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {overdue.length === 0 ? (
                <p className="text-white/50">No overdue households in this view.</p>
              ) : (
                overdue.slice(0, 10).map((m) => (
                  <div key={m.id} className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                    <span>{fullName(m)}</span>
                    <span className="text-rose">{m.memberType}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
