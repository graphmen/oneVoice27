"use client";

import Link from "next/link";
import { BookVisit } from "@/components/BookVisit";
import { MemberActions } from "@/components/MemberActions";
import { StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { Member } from "@/lib/types";
import { dueLabel, formatDate, formatLongDate, fullName, isOverdue, memberPriority, visibleMembers } from "@/lib/utils";

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
        . Conference does not book dates or message households.
      </p>
    );
  }
  const members = visibleMembers(user, state.members)
    .filter((m) => m.status === "active")
    .sort((a, b) => new Date(a.nextVisitDue).getTime() - new Date(b.nextVisitDue).getTime());

  const booked = members
    .filter((m) => m.scheduledVisitAt)
    .sort((a, b) => new Date(a.scheduledVisitAt || 0).getTime() - new Date(b.scheduledVisitAt || 0).getTime());
  const overdue = members.filter((m) => isOverdue(m) && !m.scheduledVisitAt);
  const upcoming = members.filter((m) => !isOverdue(m) && !m.scheduledVisitAt);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold">Visitation schedule</h1>
      <p className="mt-2 max-w-3xl text-white/60">
        Due date is calculated from each member’s frequency and last visit. That is not an appointment. You pick the
        day you will actually go, then WhatsApp or SMS the household — members do not have this app, so they only hear
        from you.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Step n="1" title="Due list" body="Who needs care according to frequency." />
        <Step n="2" title="Book a date" body="Choose the day you will arrive." />
        <Step n="3" title="Tell the home" body="Send WhatsApp or SMS with that date." />
      </div>
      <Section title="Booked visits" items={booked} booked empty="No dates booked yet. Pick a day on an overdue or upcoming row, then send WhatsApp." />
      <Section title="Outstanding / overdue" items={overdue} />
      <Section title="Upcoming" items={upcoming} />
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="glass rounded-lg p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-cyan">Step {n}</div>
      <div className="mt-1 font-semibold">{title}</div>
      <p className="mt-1 text-sm text-white/55">{body}</p>
    </div>
  );
}

function Section({
  title,
  items,
  booked,
  empty = "None.",
}: {
  title: string;
  items: Member[];
  booked?: boolean;
  empty?: string;
}) {
  const { state } = useStore();
  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 grid gap-2">
        {items.length === 0 && <div className="text-sm text-white/55">{empty}</div>}
        {items.map((m) => (
          <div key={m.id} className="list-row !items-start !flex-col">
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="list-row-title">{fullName(m)}</div>
                <div className="list-row-meta whitespace-normal">
                  {state.churches.find((c) => c.id === m.churchId)?.name} · due {formatDate(m.nextVisitDue)}
                  {m.scheduledVisitAt ? ` · booked ${formatLongDate(m.scheduledVisitAt)}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {booked ? <StatusBadge status="scheduled" /> : <StatusBadge status={memberPriority(m)} />}
                <span className="text-sm text-white/60">{booked ? formatDate(m.scheduledVisitAt) : dueLabel(m)}</span>
                <MemberActions member={m} size="sm" />
              </div>
            </div>
            <BookVisit member={m} compact />
          </div>
        ))}
      </div>
    </div>
  );
}
