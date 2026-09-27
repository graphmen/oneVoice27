"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRouteParam } from "@/lib/route-id";
import { ChurchForm } from "@/components/ChurchForm";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useStore } from "@/lib/store";
import { canManageChurch } from "@/lib/utils";

export default function EditChurchPage() {
  const id = useRouteParam("id");
  const router = useRouter();
  const { user, state, deleteChurch } = useStore();
  const church = state.churches.find((c) => c.id === id);
  if (!user || !church) return <p>Church not found.</p>;
  if (!canManageChurch(user, church)) {
    return <p className="text-white/70">Only conference officers can edit this congregation.</p>;
  }
  const members = state.members.filter((m) => m.churchId === church.id).length;
  const shepherds = state.users.filter((u) => u.churchIds.includes(church.id)).length;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/churches" className="btn btn-ghost">
        Back to churches
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Edit {church.name}</h1>
      <p className="mt-2 text-white/60">Update the sanctuary pin, address, or district placement.</p>
      <ChurchForm church={church} />
      <div className="mt-6">
        <ConfirmDelete
          noun="church"
          name={church.name}
          warning={
            members
              ? `This also removes ${members} member${members === 1 ? "" : "s"} and their visit records. ${shepherds ? `${shepherds} shepherd account${shepherds === 1 ? "" : "s"} stay, but this church is taken off their list.` : ""}`
              : shepherds
                ? `${shepherds} shepherd account${shepherds === 1 ? "" : "s"} will no longer list this church.`
                : "The mapped territory stays in GIS; only this registered congregation is removed."
          }
          onConfirm={() => {
            deleteChurch(church.id);
            router.push("/churches");
          }}
        />
      </div>
    </div>
  );
}
