"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EvaluationLegend, ShepherdPerformanceMatrix } from "@/components/ShepherdMatrix";
import { useStore } from "@/lib/store";
import { CONFERENCE_SHORT, HARVEST_MONTH, SYSTEM_NAME } from "@/lib/constants";
import { validCoordinates } from "@/lib/geocode";
import {
  DUTY_HINT,
  DUTY_LABEL,
  fieldCareVisits,
  flockCoverage,
  fruitCounts,
  shepherdMonitorRows,
  unassignedMembers,
  verifiedFieldVisits,
  verifiedRate,
  type DutyStatus,
} from "@/lib/care";
import { downloadCsv, fullName, isOverdue, visibleMembers, visibleVisits } from "@/lib/utils";

const DUTY_ORDER: DutyStatus[] = ["behind", "watch", "idle", "current"];

function monthsToHarvest() {
  const now = new Date();
  return Math.max(
    0,
    (HARVEST_MONTH.getFullYear() - now.getFullYear()) * 12 + (HARVEST_MONTH.getMonth() - now.getMonth()),
  );
}

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export default function ReportsPage() {
  const { user, state } = useStore();
  const [churchId, setChurchId] = useState("all");

  const members = (user ? visibleMembers(user, state.members) : []).filter(
    (m) => churchId === "all" || m.churchId === churchId,
  );
  const visits = (user ? visibleVisits(user, state.visits, state.members) : []).filter(
    (v) => churchId === "all" || v.churchId === churchId,
  );
  const completed = fieldCareVisits(visits);
  const verified = verifiedFieldVisits(visits);
  const training = visits.filter((v) => v.trainingOverride && (v.status === "completed" || v.status === "exception_approved"));
  const fruit = fruitCounts(visits);
  const coverage = flockCoverage(members);
  const overdue = members.filter((m) => isOverdue(m));
  const waiting = unassignedMembers(members);
  const unpinned = members.filter(
    (m) => m.status === "active" && (!validCoordinates(m.lat, m.lng) || (m.lat === 0 && m.lng === 0)),
  );
  const booked = visits.filter((v) => v.status === "scheduled").length;
  const pendingExceptions = visits.filter((v) => v.status === "exception_pending").length;
  const rows = user
    ? shepherdMonitorRows(user, members, visits, state.churches, state.territories, state.users).filter(
        (row) => churchId === "all" || row.pastor.churchIds.includes(churchId),
      )
    : [];
  const churches = state.churches.filter((c) => !user || user.role === "master_admin" || user.churchIds.includes(c.id));
  const viewChurches = churches.filter((c) => churchId === "all" || c.id === churchId);
  const churchName = churchId === "all" ? "All churches" : churches.find((c) => c.id === churchId)?.name || "All churches";
  const generated = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const pastors = state.users.filter((u) => u.role === "pastor" && u.status === "active");
  const viewPastors = pastors.filter((p) =>
    churchId === "all"
      ? p.churchIds.some((id) => churches.some((c) => c.id === id)) || user?.role === "master_admin"
      : p.churchIds.includes(churchId),
  );
  const churchIdsWithShepherd = new Set(viewPastors.flatMap((p) => p.churchIds));
  const churchesWithoutShepherd = viewChurches.filter((c) => !churchIdsWithShepherd.has(c.id));
  const districts = state.territories.filter((t) => t.level === "district");
  const harvestMonths = monthsToHarvest();

  const dutyMix = DUTY_ORDER.map((duty) => ({
    duty,
    label: DUTY_LABEL[duty],
    hint: DUTY_HINT[duty],
    count: rows.filter((row) => row.duty === duty).length,
  }));

  const districtRows = useMemo(() => {
    return districts
      .map((district) => {
        const dChurches = viewChurches.filter((c) => c.districtId === district.id);
        if (!dChurches.length) return null;
        const ids = new Set(dChurches.map((c) => c.id));
        const dMembers = members.filter((m) => ids.has(m.churchId) && m.status === "active");
        const dVisits = completed.filter((v) => ids.has(v.churchId));
        const dShepherds = viewPastors.filter((p) => p.churchIds.some((id) => ids.has(id)));
        const dOverdue = dMembers.filter((m) => isOverdue(m));
        return {
          id: district.id,
          name: district.shortName || district.name,
          churches: dChurches.length,
          shepherds: dShepherds.length,
          members: dMembers.length,
          overdue: dOverdue.length,
          visits: dVisits.length,
          coverage: flockCoverage(dMembers).percent,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => b.members - a.members || b.churches - a.churches || a.name.localeCompare(b.name));
  }, [districts, viewChurches, members, completed, viewPastors]);

  const byCategory = useMemo(() => {
    const max = Math.max(1, ...state.categories.map((c) => completed.filter((v) => v.categoryId === c.id).length));
    return state.categories.map((c) => {
      const count = completed.filter((v) => v.categoryId === c.id).length;
      return { name: c.name, count, width: Math.round((count / max) * 100) };
    });
  }, [state.categories, completed]);

  const brief = useMemo(() => {
    if (!members.length && !completed.length) {
      return `This is the opening board copy for ${CONFERENCE_SHORT}. The church directory is in the system (${viewChurches.length} churches, ${districtRows.length} districts). Members, assigned flocks, and GPS field visits have not been recorded in this view yet. Register shepherds, import households, pin homes — then these figures become the conference report.`;
    }
    if (!completed.length) {
      return `${members.length} household${members.length === 1 ? "" : "s"} are on the roll. Coverage is ${coverage.percent}% current. No GPS field visit has been confirmed yet. Book the first home visit, then confirm only at the door.`;
    }
    return `${coverage.active} active household${coverage.active === 1 ? "" : "s"} · ${coverage.percent}% current · ${verified.length} GPS-verified field visit${verified.length === 1 ? "" : "s"} · ${fruit.bibleStudy} Bible stud${fruit.bibleStudy === 1 ? "y" : "ies"}. Training visits stay out of the field count.`;
  }, [members.length, completed.length, viewChurches.length, districtRows.length, coverage.percent, coverage.active, verified.length, fruit.bibleStudy]);

  if (!user) return null;

  function exportReport() {
    downloadCsv("shepherd360-pastor-performance.csv", [
      ["Metric", "Value"],
      ["Scope", churchName],
      ["Churches in view", String(viewChurches.length)],
      ["Districts in view", String(districtRows.length)],
      ["Shepherds", String(rows.length)],
      ["Churches without a shepherd", String(churchesWithoutShepherd.length)],
      ["Members", String(members.length)],
      ["Unassigned members", String(waiting.length)],
      ["Homes not pinned", String(unpinned.length)],
      ["Field visits (training excluded)", String(completed.length)],
      ["GPS verified", String(verified.length)],
      ["Verified rate", `${verifiedRate(visits)}%`],
      ["Booked visits", String(booked)],
      ["Pending exceptions", String(pendingExceptions)],
      ["Training excluded", String(training.length)],
      ["Prayed", String(fruit.prayed)],
      ["Bible studies", String(fruit.bibleStudy)],
      ["Baptism interest", String(fruit.baptismInterest)],
      ["Decisions", String(fruit.decisionMade)],
      ["Overdue", String(overdue.length)],
      ["Coverage %", String(coverage.percent)],
      [],
      ["District", "Churches", "Shepherds", "Members", "Overdue", "Coverage %", "Field visits"],
      ...districtRows.map((row) => [
        row.name,
        String(row.churches),
        String(row.shepherds),
        String(row.members),
        String(row.overdue),
        String(row.coverage),
        String(row.visits),
      ]),
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

  const fieldKpis = [
    { label: "Members", value: members.length, hint: `${coverage.active} active` },
    { label: "Coverage", value: `${coverage.percent}%`, hint: `${coverage.current} current · ${overdue.length} overdue` },
    { label: "Field visits", value: completed.length, hint: `${training.length} training excluded` },
    { label: "GPS verified", value: verified.length, hint: `${verifiedRate(visits)}% of field visits` },
    { label: "Bible studies", value: fruit.bibleStudy, hint: `${fruit.baptismInterest} baptism interest` },
  ];

  const directoryKpis = [
    { label: "Churches", value: viewChurches.length, hint: churchName },
    { label: "Districts", value: districtRows.length, hint: "With a church in this view" },
    { label: "Shepherds", value: rows.length, hint: `${dutyMix.find((d) => d.duty === "idle")?.count || 0} still without a flock` },
    { label: "No shepherd", value: churchesWithoutShepherd.length, hint: "Churches waiting for a pastor login" },
    { label: "Unpinned homes", value: unpinned.length, hint: `${waiting.length} members not assigned` },
  ];

  const fruitKpis = [
    { label: "Prayed in the home", value: fruit.prayed },
    { label: "Bible studies", value: fruit.bibleStudy },
    { label: "Baptism interest", value: fruit.baptismInterest },
    { label: "Decisions", value: fruit.decisionMade },
    { label: "Referred", value: fruit.referred },
    { label: "Booked ahead", value: booked },
  ];

  const emptyStart = members.length === 0 && completed.length === 0;

  return (
    <div className="report-page mx-auto max-w-6xl">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Reports</h1>
          <p className="mt-1 text-white/60">
            Conference board copy: directory readiness, flock coverage, GPS presence, and fruit by shepherd. Training
            visits are excluded from field counts.
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
            {churchName} · Generated {generated} · {harvestMonths} month{harvestMonths === 1 ? "" : "s"} to Global Harvest
          </p>
          <p className="mt-2 hidden text-xs text-white/45 print:block">{SYSTEM_NAME}</p>
        </header>

        <p className="mt-5 text-sm leading-6 text-white/75">{brief}</p>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-white/50">Field care</h3>
        <div className="report-kpis mt-2 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {fieldKpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-white/10 bg-[#12001c]/40 px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{kpi.label}</div>
              <div className="mt-1 text-2xl font-semibold">{kpi.value}</div>
              <div className="mt-1 text-xs text-white/45">{kpi.hint}</div>
            </div>
          ))}
        </div>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-white/50">Directory readiness</h3>
        <div className="report-kpis mt-2 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {directoryKpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-white/10 bg-[#12001c]/40 px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{kpi.label}</div>
              <div className="mt-1 text-2xl font-semibold">{kpi.value}</div>
              <div className="mt-1 text-xs text-white/45">{kpi.hint}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {fruitKpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-white/10 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-white/45">{kpi.label}</div>
              <div className="mt-1 text-lg font-semibold">{kpi.value}</div>
            </div>
          ))}
        </div>

        {emptyStart ? (
          <section className="mt-6 rounded-lg border border-cyan/25 bg-cyan/5 p-4">
            <h3 className="font-semibold">What fills this sheet</h3>
            <ol className="mt-3 grid gap-2 text-sm text-white/75 lg:grid-cols-2">
              <li>
                1. Register shepherds on{" "}
                <Link href="/pastors" className="text-cyan underline-offset-2 hover:underline">
                  Pastors
                </Link>{" "}
                so each church has a login.
              </li>
              <li>
                2. Import or add households on{" "}
                <Link href="/members" className="text-cyan underline-offset-2 hover:underline">
                  Members
                </Link>
                , then assign a shepherd.
              </li>
              <li>
                3. Pin every house on the member record (search street, GPS, map, or manual coordinates).
              </li>
              <li>
                4. Book on{" "}
                <Link href="/schedule" className="text-cyan underline-offset-2 hover:underline">
                  Schedule
                </Link>
                , confirm at the door, then record prayer, study, and fruit.
              </li>
            </ol>
          </section>
        ) : null}

        <section className="mt-6">
          <h3 className="text-lg font-semibold">Shepherd rating mix</h3>
          <p className="mt-1 text-sm text-white/50">
            Same ratings as Monitor. Idle means a pastor login exists but no flock has been assigned yet.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {dutyMix.map((item) => (
              <div key={item.duty} className="rounded-lg border border-white/10 px-3 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className="text-2xl font-semibold">{item.count}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/45">{item.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-lg font-semibold">Shepherd performance</h3>
          <p className="no-print mt-1 text-sm text-white/50">
            Export CSV for the board, or print this sheet for a paper copy.
          </p>
          <EvaluationLegend />
          {rows.length === 0 ? (
            <p className="mt-3 rounded-lg border border-white/10 px-4 py-6 text-sm text-white/55">
              No shepherd logins in this view yet. Conference registers pastors on the Pastors page. They sign in the
              same day and this matrix fills as flocks are assigned.
            </p>
          ) : (
            <ShepherdPerformanceMatrix rows={rows} />
          )}
        </section>

        <section className="mt-6">
          <h3 className="text-lg font-semibold">District roll-up</h3>
          <p className="mt-1 text-sm text-white/50">
            Churches, shepherds, and flock by district in this view. Empty member columns mean import has not reached
            that field yet.
          </p>
          {districtRows.length === 0 ? (
            <p className="mt-3 text-sm text-white/50">No districts with churches in this view.</p>
          ) : (
            <div className="report-table mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/45">
                    <th className="py-2 pr-3 font-semibold">District</th>
                    <th className="py-2 pr-3 font-semibold">Churches</th>
                    <th className="py-2 pr-3 font-semibold">Shepherds</th>
                    <th className="py-2 pr-3 font-semibold">Members</th>
                    <th className="py-2 pr-3 font-semibold">Overdue</th>
                    <th className="py-2 pr-3 font-semibold">Coverage</th>
                    <th className="py-2 font-semibold">Field visits</th>
                  </tr>
                </thead>
                <tbody>
                  {districtRows.map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="py-2 pr-3 font-medium">{row.name}</td>
                      <td className="py-2 pr-3">{row.churches}</td>
                      <td className="py-2 pr-3">{row.shepherds}</td>
                      <td className="py-2 pr-3">{row.members}</td>
                      <td className="py-2 pr-3">{row.overdue}</td>
                      <td className="py-2 pr-3">{row.coverage}%</td>
                      <td className="py-2">{row.visits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-white/10 p-4">
            <h3 className="font-semibold">Visits by category</h3>
            <div className="mt-3 grid gap-3">
              {byCategory.length === 0 ? (
                <p className="text-sm text-white/50">Visit categories have not been set up yet.</p>
              ) : (
                byCategory.map((c) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span>{c.name}</span>
                      <span className="font-medium text-cyan">{c.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan/70"
                        style={{ width: `${c.count ? Math.max(c.width, 6) : 0}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="rounded-lg border border-white/10 p-4">
            <h3 className="font-semibold">Churches still without a shepherd</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {churchesWithoutShepherd.length === 0 ? (
                <p className="text-white/50">Every church in this view has a pastor login assigned.</p>
              ) : (
                churchesWithoutShepherd.slice(0, 12).map((c) => (
                  <div key={c.id} className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                    <span>{c.name}</span>
                    <span className="text-white/45">{c.city || "EZC"}</span>
                  </div>
                ))
              )}
              {churchesWithoutShepherd.length > 12 ? (
                <p className="text-xs text-white/45">
                  And {churchesWithoutShepherd.length - 12} more. Register pastors to close the gap.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-white/10 p-4">
            <h3 className="font-semibold">Members still waiting</h3>
            <p className="mt-1 text-xs text-white/45">
              Overdue households, then unassigned. {pct(overdue.length, coverage.active)}% of the active flock is past
              due.
            </p>
            <div className="mt-3 grid gap-2 text-sm">
              {overdue.length === 0 && waiting.length === 0 ? (
                <p className="text-white/50">
                  {members.length === 0
                    ? "No households in this view yet. Import or register members to start the flock."
                    : "No overdue or unassigned households in this view."}
                </p>
              ) : (
                [...overdue, ...waiting.filter((m) => !overdue.some((o) => o.id === m.id))]
                  .slice(0, 10)
                  .map((m) => (
                    <div key={m.id} className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                      <span>{fullName(m)}</span>
                      <span className="text-rose">{m.assignedPastorId ? m.memberType : "Unassigned"}</span>
                    </div>
                  ))
              )}
            </div>
          </section>
          <section className="rounded-lg border border-white/10 p-4">
            <h3 className="font-semibold">Homes not pinned</h3>
            <p className="mt-1 text-xs text-white/45">
              A visit cannot GPS-verify without a house pin. Search street, use GPS, tap the map, or enter coordinates.
            </p>
            <div className="mt-3 grid gap-2 text-sm">
              {unpinned.length === 0 ? (
                <p className="text-white/50">
                  {members.length === 0 ? "Pin homes as you register each household." : "Every household in this view has coordinates."}
                </p>
              ) : (
                unpinned.slice(0, 10).map((m) => (
                  <div key={m.id} className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                    <span>{fullName(m)}</span>
                    <span className="text-gold">Needs pin</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {pendingExceptions > 0 ? (
          <p className="mt-4 text-sm text-gold">
            {pendingExceptions} visit exception{pendingExceptions === 1 ? "" : "s"} awaiting conference review.
          </p>
        ) : null}
      </div>
    </div>
  );
}
