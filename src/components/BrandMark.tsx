import { APP_NAME, MISSION } from "@/lib/constants";
import { cx } from "@/lib/utils";

export function BrandMark({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <div className={cx("leading-tight", light && "text-white")}>
      <div className="text-[1.15rem] font-semibold tracking-tight">
        <span className="text-cyan">One</span>
        <span className="text-magenta">Voice</span>
        <span className="text-cyan">27</span>
      </div>
      {!compact && (
        <div className="text-[0.68rem] uppercase tracking-[0.22em] text-white/70">
          {APP_NAME} · {MISSION}
        </div>
      )}
    </div>
  );
}
