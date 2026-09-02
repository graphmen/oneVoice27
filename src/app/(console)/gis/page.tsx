"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GisWorkbench } from "@/components/gis/GisWorkbench";
import { useStore } from "@/lib/store";
import { canEditGis } from "@/lib/utils";

function GisInner() {
  const params = useSearchParams();
  const { user } = useStore();
  const focus = params.get("focus") || undefined;
  if (user && !canEditGis(user)) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-white/70">
        <p>
          GIS mapping is a conference tool. Your field workspace is{" "}
          <Link href="/dashboard" className="text-cyan">
            Today&apos;s flock
          </Link>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="h-full">
      <GisWorkbench initialId={focus} />
    </div>
  );
}

export default function GisPage() {
  return (
    <div className="h-full">
      <Suspense fallback={<p className="grid h-full place-items-center text-white/60">Opening GIS…</p>}>
        <GisInner />
      </Suspense>
    </div>
  );
}
