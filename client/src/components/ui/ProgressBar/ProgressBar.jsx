import { cn } from "../../../lib/utils";

const heights = { sm: "h-1.5", md: "h-2", lg: "h-3" };
const variants = {
  primary: "bg-primary",
  accent: "bg-viral",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  viral: "bg-gradient-to-r from-primary to-viral",
};

export default function ProgressBar({ value = 0, max = 100, className, showLabel, label, variant = "primary", size = "md", animate = true }) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn("w-full", className)}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-body-xs mb-1.5">
          <span className="text-text-secondary font-medium">{label || "Progress"}</span>
          <span className="font-mono font-semibold text-text tabular-nums">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={cn("w-full bg-surface-overlay rounded-full overflow-hidden relative", heights[size])}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden",
            variants[variant],
            animate && "animate-progress-fill"
          )}
          style={{ width: `${percentage}%` }}
        >
          {percentage > 5 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          )}
        </div>
      </div>
    </div>
  );
}