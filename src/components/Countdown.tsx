"use client";

import { ALL_THINGS_NEW, HARVEST_MONTH } from "@/lib/constants";
import { useEffect, useState } from "react";

function parts(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return { days, hours, mins };
}

export function Countdown() {
  const [atn, setAtn] = useState<{ days: number; hours: number; mins: number } | null>(null);
  const [harvest, setHarvest] = useState<{ days: number; hours: number; mins: number } | null>(null);

  useEffect(() => {
    const tick = () => {
      setAtn(parts(ALL_THINGS_NEW));
      setHarvest(parts(HARVEST_MONTH));
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TimeCard label="#AllThingsNew · 5 Sep 2026" value={atn} />
      <TimeCard label="Global harvest · Sep 2027" value={harvest} />
    </div>
  );
}

function TimeCard({
  label,
  value,
}: {
  label: string;
  value: { days: number; hours: number; mins: number } | null;
}) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-white/55">{label}</div>
      <div className="mt-3 flex gap-4 text-center">
        <Unit n={value?.days} l="Days" />
        <Unit n={value?.hours} l="Hours" />
        <Unit n={value?.mins} l="Mins" />
      </div>
    </div>
  );
}

function Unit({ n, l }: { n?: number; l: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold text-cyan">{n ?? "—"}</div>
      <div className="text-[11px] uppercase tracking-widest text-white/50">{l}</div>
    </div>
  );
}
