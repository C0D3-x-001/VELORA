import { cn } from "../../../lib/utils";
import Slider from "../Slider/Slider";
import Badge from "../Badge/Badge";

const POSITION_OPTIONS = [
  { label: "Upper", value: 75 },
  { label: "Center", value: 50 },
  { label: "Center Low", value: 35 },
  { label: "Lower", value: 20 },
];

const DEFAULT_CAPTION_CONFIG = {
  fontSize: 120,
  fontName: "Poppins",
  fontWeight: 700,
  maxWidthPct: 80,
  maxLines: 2,
  horizontalAlign: "center",
  verticalPct: 50,
  letterSpacing: 0,
  lineHeight: 1.3,
  paddingX: 20,
  paddingY: 20,
  textColor: "#FFFFFF",
  highlightColor: "#00D4FF",
  outlineColor: "#000000",
  outlineWidth: 4,
  shadowColor: "#000000",
  shadowDepth: 3,
  highlightBg: null,
  highlightRadius: 0,
  highlightGlow: false,
  highlightGlowColor: "#00D4FF",
  highlightGlowIntensity: 5,
  highlightScale: 1.15,
  animIn: 80,
  animOut: 80,
};

export default function CaptionEditor({ value, onChange, className }) {
  const config = { ...DEFAULT_CAPTION_CONFIG, ...value };

  const update = (key, val) => {
    onChange?.({ ...config, [key]: val });
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Caption Position */}
      <div>
        <h4 className="text-body-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Caption Position</h4>
        <div className="grid grid-cols-2 gap-2">
          {POSITION_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => update("verticalPct", opt.value)}
              className={cn(
                "relative py-3 px-4 rounded-xl text-body-xs font-medium border-2 transition-all duration-200 ease-out",
                Math.abs(config.verticalPct - opt.value) < 3
                  ? "bg-primary/10 text-primary border-primary/40"
                  : "bg-surface-subtle text-text-secondary border-border hover:bg-surface-overlay hover:border-border-strong"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Animation */}
      <div>
        <h4 className="text-body-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Animation</h4>
        <div className="space-y-4">
          <Slider
            value={config.animIn}
            onChange={(v) => update("animIn", v)}
            min={20}
            max={400}
            step={10}
            label="Pop-In Speed"
            unit="ms"
          />
          <Slider
            value={config.animOut}
            onChange={(v) => update("animOut", v)}
            min={20}
            max={400}
            step={10}
            label="Pop-Out Speed"
            unit="ms"
          />
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_CAPTION_CONFIG };