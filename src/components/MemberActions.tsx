"use client";

import Link from "next/link";
import type { Member } from "@/lib/types";
import { IconChat, IconPhone, IconPin } from "@/components/icons";
import {
  canEditMember,
  fullName,
  readyPastoralMessage,
  telHref,
  waHref,
} from "@/lib/utils";
import { useStore } from "@/lib/store";

export function MemberActions({
  member,
  size = "md",
}: {
  member: Member;
  size?: "sm" | "md";
}) {
  const { user, state } = useStore();
  if (!user) return null;
  const field = user.role === "pastor";
  const church = state.churches.find((c) => c.id === member.churchId)?.name || "church";
  const message = readyPastoralMessage(member.firstName, church);
  const call = telHref(member.phone);
  const whatsapp = waHref(member.phone, message);
  const compact = size === "sm";
  const icon = compact ? 12 : 14;
  const canEdit = canEditMember(user, member);
  const editLabel = field ? (compact ? "Edit" : "Edit / pin home") : compact ? "Assign / pin" : "Assign / pin home";

  if (!field && !canEdit) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {field &&
        (call ? (
          <a className="btn btn-cyan" href={call}>
            <IconPhone size={icon} /> Call
          </a>
        ) : (
          <span className="btn btn-ghost opacity-50">No phone</span>
        ))}
      {field && whatsapp ? (
        <a className="btn btn-cyan" href={whatsapp} target="_blank" rel="noreferrer">
          <IconChat size={icon} /> WhatsApp
        </a>
      ) : null}
      {canEdit && (
        <Link href={`/members/${member.id}/edit`} className="btn btn-ghost">
          <IconPin size={icon} /> {editLabel}
        </Link>
      )}
      {field && (
        <Link href={`/go/${member.id}`} className="btn btn-primary">
          Visit {compact ? "" : fullName(member).split(" ")[0]}
        </Link>
      )}
    </div>
  );
}
