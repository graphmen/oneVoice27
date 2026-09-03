"use client";

import { useMemo, useState } from "react";
import { EvaluationLegend, ShepherdPerformanceMatrix } from "@/components/ShepherdMatrix";
import { StatCard } from "@/components/ui";
import { useStore } from "@/lib/store";
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

  const byCategory = useMemo(() => {
    return state.categories.map((c) => ({
      name: c.name,
      count: completed.filter((v) => v.categoryId === c.id).length,
    }));
  }, [state.categories, completed]);

  const churches = state.churches.filter((c) => user.role === "master_admin" || user.churchIds.includes(c.id));

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

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Reports</h1>
          <p className="mt-1 text-white/60">
            Board-ready monitoring: flock coverage, GPS presence, and soul-winning fruit by shepherd. Training visits are
            excluded from field counts.
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
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Members" value={members.length} tone="cyan" />
        <StatCard label="Field visits" value={completed.length} tone="ok" hint={`${training.length} training excluded`} />
        <StatCard label="GPS verified" value={verified.length} tone="magenta" hint={`${verifiedRate(visits)}% of field visits`} />
        <StatCard label="Bible studies" value={fruit.bibleStudy} tone="cyan" />
        <StatCard label="Overdue care" value={overdue.length} tone="rose" />
      </div>
      <div className="glass mt-6 rounded-lg p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Pastor performance matrix</h2>
        <p className="mt-1 text-sm text-white/50">
          Same ratings as Monitor. Export CSV for the conference board. Print this page for a paper copy.
        </p>
        <EvaluationLegend />
        <ShepherdPerformanceMatrix rows={rows} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-lg p-5">
          <h2 className="font-semibold">Visits by category</h2>
          <div className="mt-4 grid gap-3">
            {byCategory.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="text-cyan">{c.count}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-linear-to-r from-magenta to-cyan"
                    style={{ width: `${completed.length ? (c.count / completed.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-lg p-5">
          <h2 className="font-semibold">Members still waiting</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {overdue.slice(0, 10).map((m) => (
              <div key={m.id} className="flex justify-between rounded-2xl bg-white/5 px-3 py-2">
                <span>{fullName(m)}</span>
                <span className="text-rose">{m.memberType}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
