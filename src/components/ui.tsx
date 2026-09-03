import { cx } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const map: Record<string, string> = {
    completed: "bg-ok/15 text-ok",
    verified: "bg-ok/15 text-ok",
    due: "bg-gold/15 text-gold",
    overdue: "bg-rose/20 text-rose",
    scheduled: "bg-cyan/15 text-cyan",
    geofence_entered: "bg-cyan/15 text-cyan",
    exception_pending: "bg-gold/15 text-gold",
    exception_approved: "bg-white/10 text-white",
    exception_rejected: "bg-rose/20 text-rose",
    high: "bg-rose/20 text-rose",
    medium: "bg-gold/15 text-gold",
    normal: "bg-cyan/15 text-cyan",
    new: "bg-ok/15 text-ok",
    crisis: "bg-rose/20 text-rose",
    followup: "bg-gold/15 text-gold",
    inactive: "bg-white/10 text-white/70",
    regular: "bg-white/10 text-white/80",
    manual: "bg-gold/15 text-gold",
    unverified: "bg-white/10 text-white/70",
    entered: "bg-ok/15 text-ok",
    training: "bg-gold/15 text-gold",
    study: "bg-cyan/15 text-cyan",
    baptism: "bg-ok/15 text-ok",
    behind: "bg-rose/20 text-rose",
    watch: "bg-gold/15 text-gold",
    current: "bg-ok/15 text-ok",
    idle: "bg-white/10 text-white/70",
    active: "bg-ok/15 text-ok",
    strong: "bg-ok/15 text-ok",
    sound: "bg-cyan/15 text-cyan",
    weak: "bg-gold/15 text-gold",
    exception: "bg-rose/20 text-rose",
  };
  return (
    <span className={cx("badge", map[status] || "bg-white/10 text-white/80", className)}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "magenta",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "magenta" | "cyan" | "gold" | "rose" | "ok";
}) {
  const ring = {
    magenta: "from-magenta/30",
    cyan: "from-cyan/30",
    gold: "from-gold/30",
    rose: "from-rose/30",
    ok: "from-ok/30",
  }[tone];
  return (
    <div className={cx("glass relative overflow-hidden rounded-3xl p-5", "bg-linear-to-br", ring, "to-transparent")}>
      <div className="text-xs uppercase tracking-[0.18em] text-white/55">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {hint && <div className="mt-2 text-sm text-white/60">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass rounded-3xl p-10 text-center">
      <div className="text-lg font-semibold">{title}</div>
      <p className="mt-2 text-white/65">{body}</p>
    </div>
  );
}

export function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (next: number) => void;
}) {
  const numbers = Array.from({ length: pages }, (_, i) => i + 1);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button type="button" className="tab" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Prev
      </button>
      {numbers.map((n) => (
        <button
          key={n}
          type="button"
          className={n === page ? "tab tab-on" : "tab"}
          onClick={() => onPage(n)}
          aria-current={n === page ? "page" : undefined}
        >
          {n}
        </button>
      ))}
      <button type="button" className="tab" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function FilterChips<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="tabs w-full sm:w-auto">
      <span className="w-full text-[10px] uppercase tracking-[0.12em] text-white/35 sm:w-11 sm:shrink-0">{label}</span>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={value === opt.id ? "tab tab-on" : "tab"}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
