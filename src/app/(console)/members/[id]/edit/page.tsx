"use client";

import { useParams } from "next/navigation";
import { MemberForm } from "@/components/MemberForm";
import { useStore } from "@/lib/store";
import { canEditMember, fullName } from "@/lib/utils";

export default function EditMemberPage() {
  const { id } = useParams<{ id: string }>();
  const { user, state } = useStore();
  const member = state.members.find((m) => m.id === id);
  if (!user || !member) return <p>Member not found.</p>;
  if (!canEditMember(user, member)) {
    return <p className="text-white/70">You can edit homes on your assigned flock, or ask an administrator to reassign this member.</p>;
  }
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold">
        {user.role === "pastor" ? `Edit ${fullName(member)}` : `Assign / pin ${fullName(member)}`}
      </h1>
      <p className="mt-2 text-white/60">
        {user.role === "pastor"
          ? "Recapture the home pin if the family moved."
          : "Assign a shepherd and keep the home pin accurate. Pastors contact the household."}
      </p>
      <MemberForm member={member} />
    </div>
  );
}
