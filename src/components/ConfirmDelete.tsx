"use client";

import { useState } from "react";

export function ConfirmDelete({
  noun,
  name,
  warning,
  onConfirm,
}: {
  noun: string;
  name: string;
  warning?: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn btn-danger w-full sm:w-auto" onClick={() => setOpen(true)}>
        Delete {noun}
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-rose/40 bg-rose/10 p-4">
      <p className="text-sm">
        Delete <span className="font-semibold">{name}</span>? This cannot be undone in this workspace.
      </p>
      {warning && <p className="mt-2 text-sm text-gold">{warning}</p>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn btn-danger w-full sm:w-auto" onClick={onConfirm}>
          Yes, delete
        </button>
        <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
