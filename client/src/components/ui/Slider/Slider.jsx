import { useCallback, useRef } from "react";
import { cn } from "../../../lib/utils";

export default function Slider({ value, onChange, min = 0, max = 100, step = 1, label, unit = "", className, disabled }) {
  const trackRef = useRef(null);

  const pct = ((value - min) / (max - min)) * 100;

  const handleChange = useCallback((e) => {
    onChange?.(Number(e.target.value));
  }, [onChange]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-body-xs font-medium text-text-secondary">{label}</span>
          <span className="text-body-xs text-text-muted tabular-nums">
            {typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}{unit}
          </span>
        </div>
      )}
      <div className="relative flex items-center h-5 group">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-surface-overlay" />
        <div
          className="absolute h-1.5 rounded-full bg-gradient-to-r from-primary to-viral"
          style={{ width: `${pct}%` }}
        />
        <input
          ref={trackRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10",
            disabled && "cursor-not-allowed"
          )}
        />
        <div
          className="absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-primary shadow-lg pointer-events-none transition-all duration-200 z-20"
          style={{ left: `calc(${pct}% - 7px)` }}
        />
      </div>
    </div>
  );
}