"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IconSearch } from "@/components/icons";
import { EmptyState, FilterChips, Pagination, StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import {
  fruitCounts,
  fruitLabel,
  isCompletedCare,
  verifiedFieldVisits,
  visitGrade,
  VISIT_GRADE_LABEL,
  type VisitGrade,
} from "@/lib/care";
import { downloadCsv, formatDateTime, fullName, visibleVisits } from "@/lib/utils";
import type { Visit } from "@/lib/types";

const VISIT_PAGE = 15;
const GROUP_PAGE = 8;
const GROUP_PREVIEW = 5;
const GRADES: Array<VisitGrade | "all"> = ["all", "strong", "sound", "weak", "exception", "training"];
const STATUSES = ["all", "completed", "exception_pending", "exception_approved", "geofence_entered"];

type GroupBy = "pastor" | "district" | "none";

export default function VisitsPage() {
  const { user, state } = useStore();
  const conference = user?.role !== "pastor";
  const [q, setQ] = useState("");
  const [districtId, setDistrictId] = useState("all");
  const [pastorId, setPastorId] = useState("all");
  const [churchId, setChurchId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [grade, setGrade] = useState<VisitGrade | "all">("all");
  const [status, setStatus] = useState("all");
  const [groupBy, setGroupBy] = useState<GroupBy>(conference ? "pastor" : "none");
  const [page, setPage] = useState(1);

  const churches = useMemo(() => {
    if (!user) return [];
    return state.churches.filter((c) => user.role === "master_admin" || user.churchIds.includes(c.id));
  }, [user, state.churches]);

  const districts = useMemo(() => {
    const ids = new Set(churches.map((c) => c.districtId).filter(Boolean));
    return state.territories
      .filter((t) => t.level === "district" && ids.has(t.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [churches, state.territories]);

  const pastors = useMemo(() => {
    return state.users
      .filter((u) => u.role === "pastor" && u.status === "active")
      .filter((p) => user?.role === "master_admin" || p.churchIds.some((id) => user?.churchIds.includes(id)))
      .filter((p) => {
        if (districtId === "all") return true;
        return p.churchIds.some((id) => state.churches.find((c) => c.id === id)?.districtId === districtId);
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [state.users, state.churches, user, districtId]);

  const churchOptions = useMemo(() => {
    return churches.filter((c) => districtId === "all" || c.districtId === districtId);
  }, [churches, districtId]);

  const rows = useMemo(() => {
    if (!user) return [];
    const needle = q.trim().toLowerCase();
    return visibleVisits(user, state.visits, state.members)
      .map((visit) => {
        const member = state.members.find((m) => m.id === visit.memberId);
        const pastor = state.users.find((u) => u.id === visit.pastorId);
        const church = state.churches.find((c) => c.id === visit.churchId);
        const district = state.territories.find((t) => t.id === church?.districtId);
        const category = state.categories.find((c) => c.id === visit.categoryId);
        return {
          visit,
          member,
          pastor,
          church,
          district,
          category,
          grade: visitGrade(visit),
        };
      })
      .filter((row) => {
        if (districtId !== "all" && row.district?.id !== districtId) return false;
        if (pastorId !== "all" && row.visit.pastorId !== pastorId) return false;
        if (churchId !== "all" && row.visit.churchId !== churchId) return false;
        if (categoryId !== "all" && row.visit.categoryId !== categoryId) return false;
        if (grade !== "all" && row.grade !== grade) return false;
        if (status !== "all" && row.visit.status !== status) return false;
        if (needle) {
          const blob = `${row.member ? fullName(row.member) : ""} ${row.pastor?.displayName || ""} ${row.church?.name || ""} ${row.district?.name || ""}`.toLowerCase();
          if (!blob.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ta = new Date(a.visit.completedAt || a.visit.createdAt).getTime();
        const tb = new Date(b.visit.completedAt || b.visit.createdAt).getTime();
        return tb - ta;
      });
  }, [user, state, q, districtId, pastorId, churchId, categoryId, grade, status]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", title: "", subtitle: "", items: rows }];
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = groupBy === "pastor" ? row.visit.pastorId : row.district?.id || "none";
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()]
      .map(([key, items]) => {
        const sample = items[0];
        const title =
          groupBy === "pastor" ? sample?.pastor?.displayName || "Unknown shepherd" : sample?.district?.name || "No district";
        const subtitle =
          groupBy === "pastor"
            ? `${sample?.district?.name || "—"} · ${sample?.church?.name || "—"}`
            : `${items.length} visit${items.length === 1 ? "" : "s"}`;
        return { key, title, subtitle, items };
      })
      .sort((a, b) => b.items.length - a.items.length);
  }, [rows, groupBy]);

  const useGroups = conference && groupBy !== "none" && pastorId === "all";
  const pages = Math.max(1, Math.ceil((useGroups ? grouped.length : rows.length) / (useGroups ? GROUP_PAGE : VISIT_PAGE)));
  const safePage = Math.min(page, pages);
  const pageGroups = useGroups
    ? grouped.slice((safePage - 1) * GROUP_PAGE, safePage * GROUP_PAGE)
    : [{ key: "all", title: "", subtitle: "", items: rows.slice((safePage - 1) * VISIT_PAGE, safePage * VISIT_PAGE) }];
  const from = rows.length === 0 ? 0 : useGroups ? 1 : (safePage - 1) * VISIT_PAGE + 1;
  const to = useGroups ? rows.length : Math.min(safePage * VISIT_PAGE, rows.length);

  useEffect(() => {
    setPage(1);
  }, [q, districtId, pastorId, churchId, categoryId, grade, status, groupBy]);

  useEffect(() => {
    if (churchId !== "all" && !churchOptions.some((c) => c.id === churchId)) setChurchId("all");
    if (pastorId !== "all" && !pastors.some((p) => p.id === pastorId)) setPastorId("all");
  }, [districtId, churchId, churchOptions, pastorId, pastors]);

  if (!user) return null;

  const field = rows.map((r) => r.visit).filter((v) => !v.trainingOverride);
  const completedField = field.filter(isCompletedCare);
  const fruit = fruitCounts(field);
  const verified = verifiedFieldVisits(field).length;
  const strong = rows.filter((r) => r.grade === "strong").length;
  const exceptions = rows.filter((r) => r.grade === "exception").length;

  function exportCsv() {
    downloadCsv("shepherd360-visits.csv", [
      ["Visit ID", "When", "Member", "Pastor", "District", "Church", "Type", "Status", "Grade", "Verification", "Duration (min)", "Training", "Fruit"],
      ...rows.map((r) => [
        r.visit.id,
        r.visit.completedAt || r.visit.createdAt,
        r.member ? fullName(r.member) : "",
        r.pastor?.displayName || "",
        r.district?.name || "",
        r.church?.name || "",
        r.category?.name || "",
        r.visit.status,
        r.grade,
        r.visit.locationVerification,
        String(r.visit.durationMinutes ?? ""),
        r.visit.trainingOverride ? "yes" : "",
        fruitLabel(r.visit),
      ]),
    ]);
  }

  function clearFilters() {
    setQ("");
    setDistrictId("all");
    setPastorId("all");
    setChurchId("all");
    setCategoryId("all");
    setGrade("all");
    setStatus("all");
  }

  const filtered = districtId !== "all" || pastorId !== "all" || churchId !== "all" || categoryId !== "all" || grade !== "all" || status !== "all" || q.trim();

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Visit records</h1>
          <p className="mt-1 text-white/60">
            {conference
              ? "One conference, many shepherds. Filter by district or pastor, then grade how each visit was done."
              : "Your field records: who, when, GPS proof, duration, and fruit. Training is marked and is not a field lock."}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      {conference && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <MiniStat label="Matching visits" value={rows.length} />
          <MiniStat label="Field visits" value={completedField.length} />
          <MiniStat label="GPS verified" value={completedField.length ? `${Math.round((verified / completedField.length) * 100)}%` : "—"} />
          <MiniStat label="Strong" value={strong} />
          <MiniStat label="Exceptions" value={exceptions} warn={exceptions > 0} />
          <MiniStat label="Studies / baptism" value={`${fruit.bibleStudy} / ${fruit.baptismInterest}`} />
        </div>
      )}

      <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(0,1fr))]">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" size={14} />
          <input
            type="search"
            className="gis-compact-input pl-8"
            placeholder={conference ? "Search member, shepherd, church, district" : "Search member"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search visits"
          />
        </div>
        {conference && (
          <>
            <select className="gis-compact-input" value={districtId} onChange={(e) => setDistrictId(e.target.value)} aria-label="District">
              <option value="all">All districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select className="gis-compact-input" value={pastorId} onChange={(e) => setPastorId(e.target.value)} aria-label="Shepherd">
              <option value="all">All shepherds</option>
              {pastors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
            <select className="gis-compact-input" value={churchId} onChange={(e) => setChurchId(e.target.value)} aria-label="Church">
              <option value="all">All churches</option>
              {churchOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select className="gis-compact-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Visit type">
              <option value="all">All types</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-x-4">
        <FilterChips
          label="Grade"
          value={grade}
          onChange={setGrade}
          options={GRADES.map((g) => ({ id: g, label: g === "all" ? "All" : VISIT_GRADE_LABEL[g] }))}
        />
        <FilterChips
          label="Status"
          value={status}
          onChange={setStatus}
          options={STATUSES.map((s) => ({ id: s, label: s === "all" ? "All" : s.replaceAll("_", " ") }))}
        />
        {conference && (
          <FilterChips
            label="Group"
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { id: "pastor", label: "Pastor" },
              { id: "district", label: "District" },
              { id: "none", label: "List" },
            ]}
          />
        )}
        {filtered && (
          <button type="button" className="tab" onClick={clearFilters}>
            Clear
          </button>
        )}
      </div>
      {conference && (
        <p className="mt-1 text-[11px] text-white/35">
          Strong = GPS + fruit · Sound = GPS only · Weak = no GPS · Exception = review · Training = not field
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/55">
        <span>
          {rows.length === 0
            ? "No visits match"
            : useGroups
              ? `${grouped.length} ${groupBy}${grouped.length === 1 ? "" : "s"} · ${rows.length} visits`
              : `Showing ${from}–${to} of ${rows.length}`}
        </span>
        {pages > 1 && <Pagination page={safePage} pages={pages} onPage={setPage} />}
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No visits match"
            body={filtered ? "Clear filters to see the full conference record." : "No visits have been recorded yet."}
          />
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {pageGroups.map((group) => (
            <section key={group.key}>
              {useGroups && (
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{group.title}</div>
                    <div className="text-xs text-white/45">
                      {group.subtitle} · {group.items.length} visit{group.items.length === 1 ? "" : "s"} ·{" "}
                      {group.items.filter((r) => r.grade === "strong").length} strong ·{" "}
                      {group.items.filter((r) => r.grade === "exception").length} exception
                    </div>
                  </div>
                  {groupBy === "pastor" && (
                    <button
                      className="tab"
                      onClick={() => {
                        setPastorId(group.key);
                        setGroupBy("none");
                      }}
                    >
                      All visits for this shepherd
                    </button>
                  )}
                  {groupBy === "district" && (
                    <button
                      className="tab"
                      onClick={() => {
                        setDistrictId(group.key);
                        setGroupBy("none");
                      }}
                    >
                      All visits in this district
                    </button>
                  )}
                </div>
              )}
              <div className="grid gap-1.5">
                {(useGroups ? group.items.slice(0, GROUP_PREVIEW) : group.items).map((row) => (
                  <VisitRow key={row.visit.id} row={row} conference={Boolean(conference)} />
                ))}
              </div>
              {useGroups && group.items.length > GROUP_PREVIEW && (
                <button
                  className="mt-1 text-xs text-cyan"
                  onClick={() => {
                    if (groupBy === "pastor") {
                      setPastorId(group.key);
                      setGroupBy("none");
                    } else {
                      setDistrictId(group.key);
                      setGroupBy("none");
                    }
                  }}
                >
                  + {group.items.length - GROUP_PREVIEW} more in this {groupBy}
                </button>
              )}
            </section>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination page={safePage} pages={pages} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-white/40">{label}</div>
      <div className={`text-base font-semibold ${warn ? "text-rose" : ""}`}>{value}</div>
    </div>
  );
}

function VisitRow({
  row,
  conference,
}: {
  row: {
    visit: Visit;
    member?: { firstName: string; lastName: string };
    pastor?: { displayName: string };
    church?: { name: string };
    district?: { name: string };
    category?: { name: string };
    grade: VisitGrade;
  };
  conference: boolean;
}) {
  const fruit = fruitLabel(row.visit);
  return (
    <Link href={`/visits/${row.visit.id}`} className="list-row">
      <div className="min-w-0 flex-1">
        <div className="list-row-title truncate">{row.member ? fullName(row.member) : row.visit.memberId}</div>
        <div className="list-row-meta">
          {formatDateTime(row.visit.completedAt || row.visit.createdAt)}
          {row.visit.durationMinutes ? ` · ${row.visit.durationMinutes} min` : ""}
          {conference ? ` · ${row.pastor?.displayName || "Unassigned shepherd"}` : ""}
          {conference ? ` · ${row.district?.name || "—"}` : ""}
          {` · ${row.church?.name || "—"}`}
          {row.category ? ` · ${row.category.name}` : ""}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={row.grade} className="px-1.5 py-0 text-[10px]" />
        <StatusBadge status={row.visit.status} className="px-1.5 py-0 text-[10px]" />
        <StatusBadge status={row.visit.locationVerification} className="px-1.5 py-0 text-[10px]" />
        {row.visit.trainingOverride && <StatusBadge status="training" className="px-1.5 py-0 text-[10px]" />}
        {fruit !== "—" && <span className="max-w-[180px] truncate text-[11px] text-white/45">{fruit}</span>}
      </div>
    </Link>
  );
}
