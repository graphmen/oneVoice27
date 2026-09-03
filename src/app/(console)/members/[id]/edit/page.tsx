"use client";

import { useParams, useRouter } from "next/navigation";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { MemberForm } from "@/components/MemberForm";
import { useStore } from "@/lib/store";
import { canDeleteMember, canEditMember, fullName } from "@/lib/utils";

export default function EditMemberPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, state, deleteMember } = useStore();
  const member = state.members.find((m) => m.id === id);
  if (!user || !member) return <p>Member not found.</p>;
  if (!canEditMember(user, member)) {
    return (
      <p className="text-white/70">
        You can edit homes on your assigned flock, or ask an administrator to reassign this member.
      </p>
    );
  }
  const visits = state.visits.filter((v) => v.memberId === member.id).length;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold">Edit {fullName(member)}</h1>
      <p className="mt-2 text-white/60">
        {user.role === "pastor"
          ? "Update this household, zoom the map onto the house and pin it by hand if the family moved, or remove the record if it was added in error."
          : "Assign a shepherd, keep the home pin accurate, or remove this record. Pastors contact the household."}
      </p>
      <MemberForm member={member} />
      {canDeleteMember(user, member) && (
        <div className="mt-6">
          <ConfirmDelete
            noun="member"
            name={fullName(member)}
            warning={
              visits
                ? `This also removes ${visits} visit record${visits === 1 ? "" : "s"} for this household.`
                : "This household will leave the flock list."
            }
            onConfirm={() => {
              deleteMember(member.id);
              router.push("/members");
            }}
          />
        </div>
      )}
    </div>
  );
}
