"use client";

import Link from "next/link";
import { MemberActions } from "@/components/MemberActions";
import { StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { Member } from "@/lib/types";
import { dueLabel, formatDate, fullName, isOverdue, memberPriority, visibleMembers } from "@/lib/utils";

export default function SchedulePage() {
  const { user, state } = useStore();
  if (!user) return null;
  if (user.role !== "pastor") {
    return (
      <p className="text-white/70">
        Visit scheduling belongs to the assigned shepherd. Conference officers watch coverage on{" "}
        <Link href="/dashboard" className="text-cyan">
          Monitor
        </Link>
        .
      </p>
    );
  }
  const members = visibleMembers(user, state.members)
    .filter((m) => m.status === "active")
    .sort((a, b) => new Date(a.nextVisitDue).getTime() - new Date(b.nextVisitDue).getTime());

  const overdue = members.filter((m) => isOverdue(m));
  const upcoming = members.filter((m) => !isOverdue(m));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold">Visitation schedule</h1>
      <p className="mt-2 text-white/60">The engine uses each member’s frequency and last visit to place them on your list.</p>
      <Section title="Outstanding / overdue" items={overdue} />
      <Section title="Upcoming" items={upcoming} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: Member[] }) {
  const { state } = useStore();
  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 grid gap-2">
        {items.length === 0 && <div className="text-sm text-white/55">None.</div>}
        {items.map((m) => (
          <div key={m.id} className="list-row">
            <div className="min-w-0 flex-1">
              <div className="list-row-title">{fullName(m)}</div>
              <div className="list-row-meta">
                {state.churches.find((c) => c.id === m.churchId)?.name} · due {formatDate(m.nextVisitDue)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={memberPriority(m)} />
              <span className="text-sm text-white/60">{dueLabel(m)}</span>
              <MemberActions member={m} size="sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
