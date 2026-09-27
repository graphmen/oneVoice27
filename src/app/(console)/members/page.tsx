"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconPlus, IconSearch } from "@/components/icons";
import { MemberActions } from "@/components/MemberActions";
import { MemberImport } from "@/components/MemberImport";
import { EmptyState, FilterChips, Pagination, StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { Member, MemberType, Priority } from "@/lib/types";
import {
  canRegisterMembers,
  dueLabel,
  fullName,
  isDueSoon,
  isOverdue,
  memberPriority,
  visibleMembers,
} from "@/lib/utils";

const PAGE_SIZE = 12;
const GROUP_PAGE = 8;
const GROUP_PREVIEW = 6;
const TYPES: Array<MemberType | "all"> = ["all", "crisis", "followup", "new", "regular", "inactive"];
const PRIORITIES: Array<Priority | "all"> = ["all", "high", "medium", "normal"];
const DUE: Array<"all" | "overdue" | "week" | "current" | "unassigned"> = [
  "all",
  "overdue",
  "week",
  "current",
  "unassigned",
];

type GroupBy = "pastor" | "district" | "none";

function MembersInner() {
  const params = useSearchParams();
  const { user, state } = useStore();
  const urlPastor = params.get("pastor") || "";
  const conference = Boolean(user && user.role !== "pastor");
  const [q, setQ] = useState("");
  const [districtId, setDistrictId] = useState("all");
  const [shepherdId, setShepherdId] = useState(urlPastor || "all");
  const [churchId, setChurchId] = useState("all");
  const [memberType, setMemberType] = useState<MemberType | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [due, setDue] = useState<(typeof DUE)[number]>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>(urlPastor ? "none" : "pastor");
  const [page, setPage] = useState(1);
  const pastor = state.users.find((u) => u.id === urlPastor);

  useEffect(() => {
    if (urlPastor) {
      setShepherdId(urlPastor);
      setGroupBy("none");
    }
  }, [urlPastor]);

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

  const shepherds = useMemo(() => {
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
    return visibleMembers(user, state.members)
      .map((member) => {
        const church = state.churches.find((c) => c.id === member.churchId);
        const district = state.territories.find((t) => t.id === church?.districtId);
        const shepherd = state.users.find((u) => u.id === member.assignedPastorId);
        return { member, church, district, shepherd, priority: memberPriority(member) };
      })
      .filter((row) => {
        const m = row.member;
        if (needle) {
          const blob = `${m.firstName} ${m.lastName} ${m.address} ${m.phone || ""} ${row.church?.name || ""} ${row.shepherd?.displayName || ""} ${m.memberType}`.toLowerCase();
          if (!blob.includes(needle)) return false;
        }
        if (districtId !== "all" && row.district?.id !== districtId) return false;
        if (shepherdId !== "all" && m.assignedPastorId !== shepherdId) return false;
        if (churchId !== "all" && m.churchId !== churchId) return false;
        if (memberType !== "all" && m.memberType !== memberType) return false;
        if (priority !== "all" && row.priority !== priority) return false;
        if (due === "overdue") return isOverdue(m);
        if (due === "week") return !isOverdue(m) && isDueSoon(m);
        if (due === "current") return !isOverdue(m) && !isDueSoon(m);
        if (due === "unassigned") return !m.assignedPastorId;
        return true;
      })
      .sort((a, b) => new Date(a.member.nextVisitDue).getTime() - new Date(b.member.nextVisitDue).getTime());
  }, [user, state.members, state.churches, state.territories, state.users, q, districtId, shepherdId, churchId, memberType, priority, due]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", title: "", subtitle: "", items: rows }];
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const key =
        groupBy === "pastor" ? row.member.assignedPastorId || "unassigned" : row.district?.id || "none";
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()]
      .map(([key, items]) => {
        const sample = items[0];
        const title =
          groupBy === "pastor"
            ? sample?.shepherd?.displayName || "Unassigned"
            : sample?.district?.name || "No district";
        const subtitle =
          groupBy === "pastor"
            ? `${sample?.district?.name || "—"} · ${sample?.church?.name || "—"}`
            : `${items.length} member${items.length === 1 ? "" : "s"}`;
        return { key, title, subtitle, items };
      })
      .sort((a, b) => {
        if (a.key === "unassigned") return -1;
        if (b.key === "unassigned") return 1;
        return b.items.length - a.items.length;
      });
  }, [rows, groupBy]);

  const useGroups = conference && groupBy !== "none" && shepherdId === "all";
  const pages = Math.max(1, Math.ceil((useGroups ? grouped.length : rows.length) / (useGroups ? GROUP_PAGE : PAGE_SIZE)));
  const safePage = Math.min(page, pages);
  const pageGroups = useGroups
    ? grouped.slice((safePage - 1) * GROUP_PAGE, safePage * GROUP_PAGE)
    : [{ key: "all", title: "", subtitle: "", items: rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE) }];
  const from = rows.length === 0 ? 0 : useGroups ? 1 : (safePage - 1) * PAGE_SIZE + 1;
  const to = useGroups ? rows.length : Math.min(safePage * PAGE_SIZE, rows.length);

  useEffect(() => {
    setPage(1);
  }, [q, districtId, shepherdId, churchId, memberType, priority, due, groupBy]);

  useEffect(() => {
    if (churchId !== "all" && !churchOptions.some((c) => c.id === churchId)) setChurchId("all");
    if (shepherdId !== "all" && shepherdId !== urlPastor && !shepherds.some((p) => p.id === shepherdId)) {
      setShepherdId("all");
    }
  }, [districtId, churchId, churchOptions, shepherdId, shepherds, urlPastor]);

  if (!user) return null;

  const overdue = rows.filter((r) => isOverdue(r.member)).length;
  const unassigned = rows.filter((r) => !r.member.assignedPastorId).length;
  const crisis = rows.filter((r) => r.member.memberType === "crisis" || r.member.memberType === "new").length;
  const filtered =
    districtId !== "all" ||
    (shepherdId !== "all" && shepherdId !== urlPastor) ||
    churchId !== "all" ||
    memberType !== "all" ||
    priority !== "all" ||
    due !== "all" ||
    q.trim();

  function clearFilters() {
    setQ("");
    setDistrictId("all");
    setShepherdId(urlPastor || "all");
    setChurchId("all");
    setMemberType("all");
    setPriority("all");
    setDue("all");
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{pastor ? `${pastor.displayName}’s flock` : "Members"}</h1>
          <p className="mt-1 text-white/60">
            {pastor
              ? "Conference view of this shepherd’s assigned members. Reassign or pin home if duty is behind. The shepherd contacts the household."
              : user.role === "pastor"
                ? "Search your flock, then Call, WhatsApp, or Visit."
                : "Register, pin, and assign. Filter by district or shepherd. Pastors contact the household."}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {pastor && (
            <Link href="/dashboard" className="btn btn-ghost">
              Back to monitor
            </Link>
          )}
          {canRegisterMembers(user) && (
            <Link href="/territories?type=member" className="btn btn-primary">
              <IconPlus size={12} /> Register
            </Link>
          )}
        </div>
      </div>

      {canRegisterMembers(user) && user.role !== "pastor" && <MemberImport />}

      {conference && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <MiniStat label="Matching" value={rows.length} />
          <MiniStat label="Overdue" value={overdue} warn={overdue > 0} />
          <MiniStat label="Unassigned" value={unassigned} warn={unassigned > 0} />
          <MiniStat label="Crisis / new" value={crisis} />
          <MiniStat label="High priority" value={rows.filter((r) => r.priority === "high").length} />
        </div>
      )}

      <div className={`mt-4 grid gap-2 ${conference ? "lg:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(0,1fr))]" : ""}`}>
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" size={14} />
          <input
            type="search"
            className="gis-compact-input pl-8"
            placeholder={conference ? "Search name, church, address, phone, or shepherd" : "Search name, address, phone"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search members"
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
            <select className="gis-compact-input" value={shepherdId} onChange={(e) => setShepherdId(e.target.value)} aria-label="Shepherd">
              <option value="all">All shepherds</option>
              {shepherds.map((p) => (
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
          </>
        )}
      </div>

      <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-x-4">
        <FilterChips
          label="Due"
          value={due}
          onChange={setDue}
          options={DUE.map((d) => ({
            id: d,
            label: d === "all" ? "All" : d === "week" ? "This week" : d === "current" ? "Current" : d === "unassigned" ? "Unassigned" : "Overdue",
          }))}
        />
        <FilterChips
          label="Type"
          value={memberType}
          onChange={setMemberType}
          options={TYPES.map((t) => ({ id: t, label: t === "all" ? "All" : t }))}
        />
        <FilterChips
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={PRIORITIES.map((p) => ({ id: p, label: p === "all" ? "All" : p }))}
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/55">
        <span>
          {rows.length === 0
            ? "No members match"
            : useGroups
              ? `${grouped.length} ${groupBy === "pastor" ? "shepherd" : "district"}${grouped.length === 1 ? "" : "s"} · ${rows.length} members`
              : `Showing ${from}–${to} of ${rows.length}`}
        </span>
        {pages > 1 && <Pagination page={safePage} pages={pages} onPage={setPage} />}
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No members match"
            body={filtered || urlPastor ? "Clear filters to see more of the flock." : "Register a member and pin their home to start visitation."}
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
                      {group.subtitle} · {group.items.length} member{group.items.length === 1 ? "" : "s"} ·{" "}
                      {group.items.filter((r) => isOverdue(r.member)).length} overdue
                    </div>
                  </div>
                  {groupBy === "pastor" && group.key !== "unassigned" && (
                    <button
                      type="button"
                      className="tab"
                      onClick={() => {
                        setShepherdId(group.key);
                        setGroupBy("none");
                      }}
                    >
                      All for this shepherd
                    </button>
                  )}
                  {groupBy === "district" && (
                    <button
                      type="button"
                      className="tab"
                      onClick={() => {
                        setDistrictId(group.key);
                        setGroupBy("none");
                      }}
                    >
                      All in this district
                    </button>
                  )}
                </div>
              )}
              <div className="grid gap-1">
                {(useGroups ? group.items.slice(0, GROUP_PREVIEW) : group.items).map((row) => (
                  <MemberRow key={row.member.id} row={row} conference={conference} />
                ))}
              </div>
              {useGroups && group.items.length > GROUP_PREVIEW && (
                <button
                  type="button"
                  className="mt-1 text-xs text-cyan"
                  onClick={() => {
                    if (groupBy === "pastor") {
                      setShepherdId(group.key);
                      setGroupBy("none");
                    } else {
                      setDistrictId(group.key);
                      setGroupBy("none");
                    }
                  }}
                >
                  + {group.items.length - GROUP_PREVIEW} more in this {groupBy === "pastor" ? "flock" : "district"}
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

function MemberRow({
  row,
  conference,
}: {
  row: {
    member: Member;
    church?: { name: string };
    district?: { name: string };
    shepherd?: { displayName: string };
    priority: Priority;
  };
  conference: boolean;
}) {
  const m = row.member;
  return (
    <div className="list-row">
      <Link href={`/members/${m.id}`} className="min-w-0 flex-1">
        <div className="list-row-title truncate">{fullName(m)}</div>
        <div className="list-row-meta">
          {m.address} · {row.church?.name || "—"}
          {conference ? ` · ${row.district?.name || "—"}` : ""}
          {conference ? ` · ${row.shepherd?.displayName || "Unassigned"}` : ""}
        </div>
      </Link>
      <div className="flex flex-wrap items-center gap-1">
        <StatusBadge status={m.memberType} className="px-1.5 py-0 text-[10px]" />
        <StatusBadge status={row.priority} className="px-1.5 py-0 text-[10px]" />
        <span className="whitespace-nowrap text-[11px] text-white/55">{dueLabel(m)}</span>
        <MemberActions member={m} size="sm" />
      </div>
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={<p className="text-white/60">Opening members…</p>}>
      <MembersInner />
    </Suspense>
  );
}
