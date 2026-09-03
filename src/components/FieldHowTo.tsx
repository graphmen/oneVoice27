"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { canRegisterMembers, fullName, visibleMembers } from "@/lib/utils";

export function FieldHowTo() {
  const { user, state } = useStore();
  if (!user) return null;
  const members = visibleMembers(user, state.members).filter((m) => m.status === "active");
  const train = members.find((m) => m.id === "mem_jane") || members[0];
  const registerHref = canRegisterMembers(user) ? "/territories?type=member" : "/members";

  return (
    <section className="glass rounded-lg p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan">In this system</div>
      <h2 className="mt-1 text-xl font-semibold">Field tools you can use now</h2>
      <ol className="mt-4 grid gap-3 text-sm">
        <li className="rounded-2xl bg-white/5 p-4">
          <div className="font-semibold">1. Pin the home</div>
          <p className="mt-1 text-white/65">
            Register or edit a member, zoom the map onto the house, and tap Pin this house. You do not need to be there.
            Pin my GPS is only if you are standing at the door. That pin is the geofence.
          </p>
          <Link href={registerHref} className="btn btn-cyan mt-3 py-2 text-xs">
            Register / pin a home
          </Link>
        </li>
        <li className="rounded-2xl bg-white/5 p-4">
          <div className="font-semibold">2. Call and WhatsApp</div>
          <p className="mt-1 text-white/65">
            Cyan Call and WhatsApp buttons sit on every member row, the profile, and the visit screen, with a ready
            pastoral message.
          </p>
          <Link href="/members" className="btn btn-cyan mt-3 py-2 text-xs">
            Open members
          </Link>
        </li>
        <li className="rounded-2xl bg-white/5 p-4">
          <div className="font-semibold">3. Edit when a family moves</div>
          <p className="mt-1 text-white/65">
            Open Edit / pin home to move the pin by hand on the map, recapture GPS at the door, or change the assigned
            pastor. Administrators can reassign shepherds; pastors can update homes on their own flock.
          </p>
          <Link href="/members" className="btn btn-ghost mt-3 py-2 text-xs">
            Find a member to edit
          </Link>
        </li>
        <li className="rounded-2xl bg-white/5 p-4">
          <div className="font-semibold">4. Train the geofence without driving</div>
          <p className="mt-1 text-white/65">
            Open a visit{train ? ` as for ${fullName(train)}` : ""} and tap Stand at the door (training). Confirm
            unlocks, and the record is marked as training, not a field GPS lock. Master admin can turn that off in
            Settings.
          </p>
          {train ? (
            <Link href={`/go/${train.id}`} className="btn btn-primary mt-3 py-2 text-xs">
              Open training visit
            </Link>
          ) : null}
        </li>
        <li className="rounded-2xl bg-white/5 p-4">
          <div className="font-semibold">5. Visit duration is stored automatically</div>
          <p className="mt-1 text-white/65">
            Time on the visit screen is counted while you are there and saved on the visit record.
          </p>
          <Link href="/visits" className="btn btn-ghost mt-3 py-2 text-xs">
            Visit records
          </Link>
        </li>
      </ol>
    </section>
  );
}
