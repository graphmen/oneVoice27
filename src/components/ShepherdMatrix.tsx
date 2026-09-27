import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { DUTY_HINT, DUTY_LABEL, type DutyStatus } from "@/lib/care";
import { formatDate } from "@/lib/utils";

type Row = {
  pastor: { id: string; displayName: string };
  assigned: number;
  overdue: number;
  fieldVisits: number;
  verified: number;
  verifiedPct: number;
  coverage: number;
  prayed: number;
  bibleStudy: number;
  baptismInterest: number;
  decisionMade: number;
  lastVisitAt?: string;
  districtName: string;
  churchName: string;
  duty: DutyStatus;
  reason: string;
};

const RATINGS: DutyStatus[] = ["behind", "watch", "current", "idle"];

export function EvaluationLegend() {
  return (
    <div className="no-print mt-4 grid gap-3 lg:grid-cols-3">
      <div className="glass rounded-lg p-4">
        <div className="text-[11px] uppercase tracking-[0.16em] text-cyan">1. Coverage</div>
        <p className="mt-2 text-sm text-white/70">
          Share of the assigned flock that is <span className="text-white">not overdue</span>. Below 70% or 3+ overdue
          households places a shepherd Behind.
        </p>
      </div>
      <div className="glass rounded-lg p-4">
        <div className="text-[11px] uppercase tracking-[0.16em] text-cyan">2. Presence</div>
        <p className="mt-2 text-sm text-white/70">
          Field visits confirmed at the home by GPS. Training locks do not count. Under 60% verified, or no field visit
          at all, is a performance problem.
        </p>
      </div>
      <div className="glass rounded-lg p-4">
        <div className="text-[11px] uppercase tracking-[0.16em] text-cyan">3. Fruit</div>
        <p className="mt-2 text-sm text-white/70">
          Prayer, Bible study, baptism interest, and decisions recorded on those field visits. Fruit does not change the
          rating by itself — it shows whether presence is producing souls.
        </p>
      </div>
      <div className="lg:col-span-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {RATINGS.map((rating) => (
          <div key={rating} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
            <StatusBadge status={rating} />
            <p className="mt-2 text-xs leading-relaxed text-white/60">{DUTY_HINT[rating]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShepherdPerformanceMatrix({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-white/55">No shepherds in this view yet.</p>;
  }

  return (
    <>
      <div className="mt-4 grid gap-3 print-hidden md:hidden">
        {rows.map((row) => (
          <Link key={row.pastor.id} href={`/members?pastor=${row.pastor.id}`} className="rounded-lg bg-white/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{row.pastor.displayName}</div>
                <div className="text-xs text-white/45">
                  {row.districtName} · {row.churchName}
                </div>
              </div>
              <StatusBadge status={row.duty} />
            </div>
            <p className="mt-2 text-xs text-white/60">{row.reason}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-white/65">
              <div>
                Coverage
                <div className={`mt-0.5 font-semibold ${row.coverage < 70 ? "text-rose" : "text-white"}`}>{row.coverage}%</div>
              </div>
              <div>
                GPS proof
                <div className="mt-0.5 font-semibold text-white">
                  {row.fieldVisits ? `${row.verifiedPct}%` : "None"}
                </div>
              </div>
              <div>
                Fruit
                <div className="mt-0.5 font-semibold text-white">
                  {row.prayed + row.bibleStudy + row.baptismInterest + row.decisionMade}
                </div>
              </div>
            </div>
            <div className="sr-only">{DUTY_LABEL[row.duty]}</div>
          </Link>
        ))}
      </div>
      <div className="report-table table-scroll mt-4 hidden md:block print:block">
        <table className="w-full min-w-[860px] text-left text-sm print:min-w-0">
          <thead className="text-xs uppercase tracking-wide text-white/45">
            <tr>
              <th className="pb-3">Shepherd</th>
              <th>Rating</th>
              <th>Why this rating</th>
              <th>Coverage</th>
              <th>GPS proof</th>
              <th>Fruit</th>
              <th>Last field visit</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pastor.id} className="border-t border-white/8 align-top">
                <td className="py-3">
                  <div>{row.pastor.displayName}</div>
                  <div className="text-xs text-white/45">
                    {row.districtName} · {row.churchName} · {row.assigned} assigned
                  </div>
                </td>
                <td className="py-3">
                  <StatusBadge status={row.duty} />
                </td>
                <td className="max-w-[220px] py-3 text-white/70">{row.reason}</td>
                <td className={`py-3 ${row.coverage < 70 || row.overdue ? "text-rose" : ""}`}>
                  {row.coverage}%
                  <div className="text-xs text-white/45">{row.overdue} overdue</div>
                </td>
                <td className="py-3">
                  {row.fieldVisits ? `${row.verified}/${row.fieldVisits} · ${row.verifiedPct}%` : "No field visits"}
                </td>
                <td className="py-3 text-white/70">
                  {row.bibleStudy} studies
                  <div className="text-xs text-white/45">
                    {row.baptismInterest} baptism · {row.decisionMade} decision · {row.prayed} prayed
                  </div>
                </td>
                <td className="py-3 text-white/60">{formatDate(row.lastVisitAt)}</td>
                <td className="no-print py-3 text-right">
                  <Link href={`/members?pastor=${row.pastor.id}`} className="text-cyan">
                    Flock
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
