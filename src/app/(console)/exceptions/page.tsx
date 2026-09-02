"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import { canApproveExceptions, formatDateTime, fullName, visibleVisits } from "@/lib/utils";

export default function ExceptionsPage() {
  const { user, state, reviewException } = useStore();
  if (!user) return null;
  const visits = visibleVisits(user, state.visits, state.members).filter((v) =>
    ["exception_pending", "exception_approved", "exception_rejected"].includes(v.status),
  );
  const can = canApproveExceptions(user);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold">Manual verification</h1>
      <p className="mt-2 text-white/60">
        Hospitals, poor GPS, moved homes, and emergencies are real. Exceptions stay clearly marked as administrator-approved
        — never as GPS-verified.
      </p>
      <div className="mt-6 grid gap-1">
        {visits.length === 0 && <p className="text-white/60">No exception requests.</p>}
        {visits.map((v) => {
          const m = state.members.find((x) => x.id === v.memberId);
          const p = state.users.find((u) => u.id === v.pastorId);
          return (
            <div key={v.id} className="list-row items-start">
              <div className="min-w-0 flex-1">
                <div className="list-row-title">{m ? fullName(m) : v.memberId}</div>
                <div className="list-row-meta">
                  {p?.displayName} · {formatDateTime(v.createdAt)}
                </div>
                <p className="mt-1 text-sm text-white/80">{v.exceptionReason}</p>
                {v.adminNotes && <p className="mt-1 text-xs text-white/55">{v.adminNotes}</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Link href={`/visits/${v.id}`} className="btn btn-ghost">
                    Open record
                  </Link>
                  {can && v.status === "exception_pending" && (
                    <>
                      <button className="btn btn-cyan" onClick={() => reviewException(v.id, true, user.id)}>
                        Approve as manual visit
                      </button>
                      <button className="btn btn-danger" onClick={() => reviewException(v.id, false, user.id)}>
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
              <StatusBadge status={v.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
