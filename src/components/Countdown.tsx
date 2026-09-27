"use client";

import { HARVEST_MONTH } from "@/lib/constants";
import { useEffect, useState } from "react";

function parts(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return { days, hours, mins };
}

export function Countdown() {
  const [harvest, setHarvest] = useState<{ days: number; hours: number; mins: number } | null>(null);

  useEffect(() => {
    const tick = () => setHarvest(parts(HARVEST_MONTH));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="glass rounded-3xl p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-white/55">Global harvest · Sep 2027</div>
      <div className="mt-3 flex justify-between gap-2 text-center sm:justify-start sm:gap-4">
        <Unit n={harvest?.days} l="Days" />
        <Unit n={harvest?.hours} l="Hours" />
        <Unit n={harvest?.mins} l="Mins" />
      </div>
    </div>
  );
}

function Unit({ n, l }: { n?: number; l: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold text-cyan sm:text-3xl">{n ?? "—"}</div>
      <div className="text-[11px] uppercase tracking-widest text-white/50">{l}</div>
    </div>
  );
}
