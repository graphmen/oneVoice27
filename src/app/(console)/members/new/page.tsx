"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function NewMemberRedirect() {
  const router = useRouter();
  const query = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams({ type: "member" });
    const church = query.get("church");
    const district = query.get("district");
    const territory = query.get("territory");
    if (church) params.set("church", church);
    if (district) params.set("district", district);
    if (territory) params.set("territory", territory);
    router.replace(`/territories?${params.toString()}`);
  }, [query, router]);

  return <p className="text-white/60">Opening registration…</p>;
}

export default function NewMemberPage() {
  return (
    <Suspense fallback={<p className="text-white/60">Opening registration…</p>}>
      <NewMemberRedirect />
    </Suspense>
  );
}
