"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRouteParam } from "@/lib/route-id";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ShepherdForm } from "@/components/ShepherdForm";
import { useStore } from "@/lib/store";
import { canDeleteAccount, canManageAccount } from "@/lib/utils";

export default function EditShepherdPage() {
  const id = useRouteParam("id");
  const router = useRouter();
  const { user, state, deleteUser } = useStore();
  const account = state.users.find((u) => u.id === id);
  if (!user || !account) return <p>Shepherd not found.</p>;
  if (!canManageAccount(user, account)) {
    return <p className="text-white/70">Only conference officers can edit this account.</p>;
  }
  const flock = state.members.filter((m) => m.assignedPastorId === account.id).length;
  const canDelete = canDeleteAccount(user, account);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/pastors" className="btn btn-ghost">
        Back to shepherds
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Edit {account.displayName}</h1>
      <p className="mt-2 text-white/60">Update contact details, role, or district and church assignment.</p>
      <ShepherdForm account={account} />
      {canDelete ? (
        <div className="mt-6">
          <ConfirmDelete
            noun="account"
            name={account.displayName}
            warning={
              flock
                ? `${flock} member${flock === 1 ? "" : "s"} will become unassigned. Visit history stays on record.`
                : "Visit history stays on record. This person will no longer be able to sign in."
            }
            onConfirm={() => {
              deleteUser(account.id);
              router.push("/pastors");
            }}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-white/50">
          {user.id === account.id
            ? "You cannot delete the account you are signed in with."
            : "Master administrator accounts cannot be deleted here."}
        </p>
      )}
    </div>
  );
}
