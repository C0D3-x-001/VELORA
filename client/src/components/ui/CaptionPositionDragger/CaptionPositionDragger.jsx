import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "../../../lib/utils";

const PRESETS = [
  { label: "Upper", value: "upper", pct: 85 },
  { label: "Center", value: "center", pct: 50 },
  { label: "Center Low", value: "center-low", pct: 30 },
  { label: "Lower", value: "lower", pct: 12 },
];

function positionToPct(pos) {
  if (typeof pos === "number") return pos;
  const found = PRESETS.find((p) => p.value === pos);
  return found ? found.pct : 50;
}

function pctToPosition(pct) {
  for (const p of PRESETS) {
    if (Math.abs(p.pct - pct) < 4) return p.value;
  }
  return Math.round(pct);
}

export default function CaptionPositionDragger({ value = "center", onChange, className }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);
  const pctRef = useRef(50);
  const [pct, setPct] = useState(() => positionToPct(value));
  const [hoverPct, setHoverPct] = useState(null);

  useEffect(() => {
    setPct(positionToPct(value));
  }, [value]);

  useEffect(() => {
    pctRef.current = pct;
  }, [pct]);

  const computePct = useCallback((clientY) => {
    const rect = trackRef.current.getBoundingClientRect();
    const raw = ((rect.bottom - clientY) / rect.height) * 100;
    return Math.max(2, Math.min(98, raw));
  }, []);

  const commit = useCallback((newPct) => {
    setPct(newPct);
    onChange?.(pctToPosition(newPct));
  }, [onChange]);

  useEffect(() => {
    if (!dragging.current) return;
    const onMove = (e) => {
      const p = computePct(e.clientY);
      setPct(p);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      commit(pctToPosition(pctRef.current));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [commit, computePct]);

  const handlePointerDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  };

  return (
    <div className={cn("flex items-end gap-3", className)}>
      <div
        ref={trackRef}
        className="relative w-16 h-28 rounded-lg border border-border bg-surface-subtle overflow-hidden cursor-crosshair shrink-0"
        onPointerDown={(e) => {
          const p = computePct(e.clientY);
          setPct(p);
          handlePointerDown(e);
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <div className="w-8 h-5 rounded-full border border-current" />
        </div>

        <div
          className="absolute left-0 right-0 h-0.5 bg-primary pointer-events-none"
          style={{ bottom: `${pct}%` }}
        />

        <div
          className="absolute left-1/2 -translate-x-1/2 w-5 h-2 rounded-sm bg-primary shadow-md pointer-events-none"
          style={{ bottom: `calc(${pct}% - 4px)` }}
          onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e); }}
        />

        {PRESETS.map((p) => (
          <div
            key={p.value}
            className={cn(
              "absolute right-0 w-2 h-px pointer-events-none transition-opacity duration-100",
              Math.abs(p.pct - pct) < 4 ? "bg-primary opacity-100" : "bg-text/30 opacity-60"
            )}
            style={{ bottom: `${p.pct}%` }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => { setPct(p.pct); commit(p.value); }}
            className={cn(
              "text-xs px-2.5 py-1.5 rounded-lg border transition-all duration-150 text-left",
              value === p.value
                ? "bg-primary/15 text-primary border-primary/30 font-medium"
                : "bg-surface-subtle text-text-secondary border-border hover:bg-surface-overlay hover:text-text"
            )}
          >
            {p.label}
          </button>
        ))}
        {typeof pctToPosition(pct) === "number" && (
          <div className="text-xs text-text-secondary px-2.5 py-1">
            {Math.round(pct)}%
          </div>
        )}
      </div>
    </div>
  );
}
