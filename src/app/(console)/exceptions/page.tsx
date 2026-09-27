"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import { validCoordinates } from "@/lib/geocode";
import {
  canApproveExceptions,
  formatDateTime,
  fullName,
  visibleMembers,
  visibleVisits,
} from "@/lib/utils";
import type { Visit } from "@/lib/types";

type Filter = "pending" | "approved" | "rejected" | "all";

const GROUNDS = [
  {
    title: "Hospital or institution",
    body: "The member is in a ward, prison, or care home. The geofence is at the house, not at the bedside.",
  },
  {
    title: "Poor GPS",
    body: "Indoor signal, dense suburb, or a phone that will not lock. The shepherd was there — the satellite was not.",
  },
  {
    title: "Moved home",
    body: "The pin is still on the old house. Re-pin the record after the visit so the next confirmation can lock.",
  },
  {
    title: "Emergency",
    body: "A crisis call that could not wait for a clean lock. Write what happened. Conference still reviews it.",
  },
];

function isException(visit: Visit) {
  return ["exception_pending", "exception_approved", "exception_rejected"].includes(visit.status);
}

export default function ExceptionsPage() {
  const { user, state, reviewException } = useStore();
  const [filter, setFilter] = useState<Filter>("pending");

  const allVisits = user ? visibleVisits(user, state.visits, state.members) : [];
  const members = user ? visibleMembers(user, state.members) : [];
  const exceptions = allVisits.filter(isException);
  const pending = exceptions.filter((v) => v.status === "exception_pending");
  const approved = exceptions.filter((v) => v.status === "exception_approved");
  const rejected = exceptions.filter((v) => v.status === "exception_rejected");
  const weak = allVisits.filter(
    (v) =>
      v.status === "completed" &&
      !v.trainingOverride &&
      v.locationVerification !== "verified" &&
      v.locationVerification !== "manual",
  );
  const unpinned = members.filter(
    (m) => m.status === "active" && (!validCoordinates(m.lat, m.lng) || (m.lat === 0 && m.lng === 0)),
  );
  const training = allVisits.filter((v) => v.trainingOverride && (v.status === "completed" || v.status === "exception_approved"));
  const can = user ? canApproveExceptions(user) : false;
  const needsApproval = state.settings.exceptionRequiresApproval !== false;

  const shown = useMemo(() => {
    const list =
      filter === "pending"
        ? pending
        : filter === "approved"
          ? approved
          : filter === "rejected"
            ? rejected
            : exceptions;
    return [...list].sort((a, b) => (b.exceptionReviewedAt || b.createdAt).localeCompare(a.exceptionReviewedAt || a.createdAt));
  }, [filter, pending, approved, rejected, exceptions]);

  if (!user) return null;

  const kpis = [
    { label: "Pending", value: pending.length, hint: can ? "Waiting on conference" : "Waiting on your clerk" },
    { label: "Approved manual", value: approved.length, hint: "Field care — not GPS-verified" },
    { label: "Rejected", value: rejected.length, hint: "Did not count as a visit" },
    { label: "Weak GPS locks", value: weak.length, hint: "Completed without a geofence lock" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Manual verification</h1>
          <p className="mt-2 max-w-2xl text-white/60">
            Hospitals, poor GPS, moved homes, and emergencies are real. An exception is a pastoral visit that conference
            marks by hand. It never becomes GPS-verified.
          </p>
        </div>
        <div className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gold">Queue</div>
          <div className="text-3xl font-semibold text-gold">{pending.length}</div>
          <div className="text-xs text-white/55">pending</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{kpi.label}</div>
            <div className="mt-1 text-2xl font-semibold">{kpi.value}</div>
            <div className="mt-1 text-xs text-white/45">{kpi.hint}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["pending", `Pending (${pending.length})`],
                ["approved", `Approved (${approved.length})`],
                ["rejected", `Rejected (${rejected.length})`],
                ["all", `All (${exceptions.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={filter === id ? "btn btn-cyan py-2 text-xs" : "btn btn-ghost py-2 text-xs"}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-2">
            {shown.length === 0 ? (
              <div className="rounded-lg border border-white/10 px-4 py-8">
                <p className="font-semibold">
                  {filter === "pending"
                    ? "No exceptions waiting."
                    : filter === "approved"
                      ? "No manual visits approved yet."
                      : filter === "rejected"
                        ? "No exceptions have been rejected."
                        : "No exception requests in this view."}
                </p>
                <p className="mt-2 max-w-xl text-sm text-white/55">
                  When a pastor cannot lock GPS at the home, they open the visit, tap Request manual verification, and
                  write why. Conference reviews it here. Approved visits count as field care — never as GPS-verified.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/visits" className="btn btn-ghost py-2 text-xs">
                    Open visit records
                  </Link>
                  <Link href="/schedule" className="btn btn-cyan py-2 text-xs">
                    Book a visit
                  </Link>
                </div>
              </div>
            ) : (
              shown.map((v) => {
                const m = state.members.find((x) => x.id === v.memberId);
                const p = state.users.find((u) => u.id === v.pastorId);
                const church = state.churches.find((c) => c.id === v.churchId);
                const reviewer = state.users.find((u) => u.id === v.exceptionApprovedBy);
                return (
                  <div key={v.id} className="list-row items-start">
                    <div className="min-w-0 flex-1">
                      <div className="list-row-title">{m ? fullName(m) : v.memberId}</div>
                      <div className="list-row-meta">
                        {p?.displayName || "Shepherd"} · {church?.name || "Church"} · {formatDateTime(v.createdAt)}
                      </div>
                      <p className="mt-2 text-sm text-white/80">{v.exceptionReason || "No reason written."}</p>
                      {v.adminNotes ? <p className="mt-1 text-xs text-white/55">{v.adminNotes}</p> : null}
                      {v.exceptionReviewedAt ? (
                        <p className="mt-1 text-xs text-white/45">
                          Reviewed {formatDateTime(v.exceptionReviewedAt)}
                          {reviewer ? ` · ${reviewer.displayName}` : ""}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-1">
                        <Link href={`/visits/${v.id}`} className="btn btn-ghost">
                          Open record
                        </Link>
                        {m ? (
                          <Link href={`/members/${m.id}`} className="btn btn-ghost">
                            Household
                          </Link>
                        ) : null}
                        {can && v.status === "exception_pending" ? (
                          <>
                            <button className="btn btn-cyan" onClick={() => reviewException(v.id, true, user.id)}>
                              Approve as manual visit
                            </button>
                            <button className="btn btn-danger" onClick={() => reviewException(v.id, false, user.id)}>
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                );
              })
            )}
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="rounded-lg border border-white/10 p-4">
            <h2 className="font-semibold">How this desk works</h2>
            <ol className="mt-3 grid gap-2 text-sm text-white/70">
              <li>1. Pastor confirms at the door. GPS must lock inside the house pin.</li>
              <li>2. If the lock fails, they request a manual exception and write the reason.</li>
              <li>
                3. {can ? "You approve it as a manual visit, or reject it." : "Conference or the church clerk reviews it."}
              </li>
              <li>4. Approved = field care. The record stays marked manual — never GPS-verified.</li>
            </ol>
            <p className="mt-3 text-xs text-white/45">
              {needsApproval
                ? "Settings require conference approval before an exception counts."
                : "Settings currently allow exceptions without a second review. Turn approval back on if the board wants a paper trail."}
            </p>
            {user.role === "master_admin" ? (
              <Link href="/settings" className="btn btn-ghost mt-3 py-2 text-xs">
                Open settings
              </Link>
            ) : null}
          </section>

          <section className="rounded-lg border border-white/10 p-4">
            <h2 className="font-semibold">When to use an exception</h2>
            <div className="mt-3 grid gap-3">
              {GROUNDS.map((item) => (
                <div key={item.title}>
                  <div className="text-sm font-semibold">{item.title}</div>
                  <p className="mt-1 text-xs leading-5 text-white/50">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 p-4">
            <h2 className="font-semibold">Related field signals</h2>
            <p className="mt-1 text-xs text-white/45">
              These are not in the exception queue, but they produce the same hole: a visit without a clean GPS lock.
            </p>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                <span>Completed without GPS</span>
                <span className="text-gold">{weak.length}</span>
              </div>
              <div className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                <span>Homes not pinned</span>
                <span className="text-gold">{unpinned.length}</span>
              </div>
              <div className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                <span>Training visits excluded</span>
                <span className="text-white/60">{training.length}</span>
              </div>
            </div>
            {weak.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {weak.slice(0, 5).map((v) => {
                  const m = state.members.find((x) => x.id === v.memberId);
                  return (
                    <Link key={v.id} href={`/visits/${v.id}`} className="rounded-lg bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                      {m ? fullName(m) : v.memberId}
                      <span className="mt-0.5 block text-xs text-white/45">Open the record</span>
                    </Link>
                  );
                })}
              </div>
            ) : unpinned.length > 0 ? (
              <p className="mt-3 text-xs text-white/50">
                Pin homes on the member record so the next visit can lock. Unpinned houses force exceptions.
              </p>
            ) : (
              <p className="mt-3 text-xs text-white/50">No weak locks or unpinned homes in this view.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/members" className="btn btn-ghost py-2 text-xs">
                Pin homes
              </Link>
              <Link href="/visits" className="btn btn-ghost py-2 text-xs">
                Visit ledger
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
