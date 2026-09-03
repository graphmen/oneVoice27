"use client";

import { useEffect, useState } from "react";
import { IconChat } from "@/components/icons";
import { useStore } from "@/lib/store";
import type { Member } from "@/lib/types";
import {
  appointmentMessage,
  formatLongDate,
  fromDateInput,
  smsHref,
  todayInput,
  toDateInput,
  waHref,
} from "@/lib/utils";

export function BookVisit({
  member,
  compact = false,
}: {
  member: Member;
  compact?: boolean;
}) {
  const { user, scheduleVisit, cancelScheduledVisit } = useStore();
  const [date, setDate] = useState(() => toDateInput(member.scheduledVisitAt || member.nextVisitDue) || todayInput());
  const [note, setNote] = useState("");

  useEffect(() => {
    setDate(toDateInput(member.scheduledVisitAt || member.nextVisitDue) || todayInput());
  }, [member.id, member.scheduledVisitAt, member.nextVisitDue]);

  if (!user || user.role !== "pastor") return null;

  const dateLabel = date ? formatLongDate(fromDateInput(date)) : "";
  const message = appointmentMessage(member.firstName, user.displayName, dateLabel);
  const whatsapp = waHref(member.phone, message);
  const sms = smsHref(member.phone, message);
  const booked = Boolean(member.scheduledVisitAt);

  function book(notify?: "whatsapp" | "sms") {
    if (!user || !date) {
      setNote("Pick a date first.");
      return;
    }
    const iso = fromDateInput(date);
    scheduleVisit(member.id, iso, user.id);
    const label = formatLongDate(iso);
    if (notify === "whatsapp") {
      if (whatsapp) {
        window.open(whatsapp, "_blank", "noopener,noreferrer");
        setNote(`Saved. WhatsApp is opening so you can tell ${member.firstName} you are coming on ${label}.`);
      } else {
        setNote(`Saved for ${label}, but this household has no phone. Call or visit to tell them.`);
      }
      return;
    }
    if (notify === "sms") {
      if (sms) {
        window.location.href = sms;
        setNote(`Saved. SMS is opening so you can tell ${member.firstName} you are coming on ${label}.`);
      } else {
        setNote(`Saved for ${label}, but this household has no phone. Call or visit to tell them.`);
      }
      return;
    }
    setNote(
      member.phone
        ? `Saved for ${label}. Now tap WhatsApp or SMS so ${member.firstName} hears the date — they do not have this app.`
        : `Saved for ${label}. This household has no phone, so tell them in person.`,
    );
  }

  return (
    <div className={compact ? "w-full min-w-0" : ""}>
      {!compact && (
        <>
          <div className="text-xs uppercase tracking-[0.18em] text-cyan">Book a visit</div>
          <h2 className="mt-1 text-lg font-semibold">Tell {member.firstName} you are coming</h2>
          <p className="mt-2 text-sm text-white/60">
            Due date is automatic from frequency. The booked date is the day you actually plan to arrive. Members do
            not log in — send WhatsApp or SMS with that date.
          </p>
        </>
      )}
      {booked ? (
        <p className={compact ? "text-xs text-cyan" : "mt-3 text-sm text-cyan"}>
          Booked for {formatLongDate(member.scheduledVisitAt)}
        </p>
      ) : compact ? (
        <p className="text-xs text-white/50">No day booked yet — pick a date and send WhatsApp or SMS.</p>
      ) : null}
      <div className={`flex flex-wrap items-end gap-2 ${compact ? "mt-2" : "mt-4"}`}>
        <label className="w-[11rem] text-xs text-white/55">
          Visit date
          <input
            className="mt-1"
            type="date"
            min={todayInput()}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setNote("");
            }}
          />
        </label>
        <button type="button" className="btn btn-ghost py-2 text-xs" onClick={() => book()}>
          Save date
        </button>
        <button type="button" className="btn btn-cyan py-2 text-xs" onClick={() => book("whatsapp")}>
          <IconChat size={12} /> Book & WhatsApp
        </button>
        <button type="button" className="btn btn-cyan py-2 text-xs" onClick={() => book("sms")} disabled={!sms}>
          Book & SMS
        </button>
        {booked ? (
          <button
            type="button"
            className="btn btn-ghost py-2 text-xs"
            onClick={() => {
              cancelScheduledVisit(member.id);
              setNote("Booking cleared.");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      {!compact && (
        <p className="mt-3 text-sm text-white/70">
          Message: “{message}”
        </p>
      )}
      {note ? <p className={`text-sm text-ok ${compact ? "mt-2" : "mt-3"}`}>{note}</p> : null}
      {!member.phone && (
        <p className={`text-xs text-gold ${compact ? "mt-2" : "mt-2"}`}>
          No phone on this record — the date can still be saved, but the household will not get a message from here.
        </p>
      )}
    </div>
  );
}
