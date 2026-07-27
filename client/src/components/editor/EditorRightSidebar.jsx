import { useState, useEffect, useMemo, useCallback } from "react";
import { Palette, Type, Move, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import Slider from "../ui/Slider/Slider";
import CaptionPreview from "../ui/CaptionPreview/CaptionPreview";
import { cn } from "../../lib/utils";
import { PRESET_LIST, getCaptionPresetStyle } from "../../lib/captionPresets";

const FONTS = [
  { value: "Poppins", label: "Poppins" },
  { value: "Inter", label: "Inter" },
  { value: "Impact", label: "Impact" },
  { value: "Bebas Neue", label: "Bebas Neue" },
  { value: "Montserrat", label: "Montserrat" },
];

function Section({ icon: Icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-subtle/50 transition-colors"
      >
        <Icon className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-text uppercase tracking-wider flex-1">{title}</span>
        {open ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function toHexColor(color) {
  if (!color) return "#FFFFFF";
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) return "#" + color[1]+color[1]+color[2]+color[2]+color[3]+color[3];
  var ctx = document.createElement("canvas").getContext("2d");
  ctx.fillStyle = color;
  return ctx.fillStyle;
}

function ColorInput({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="color"
          value={toHexColor(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded-lg border border-border cursor-pointer bg-transparent"
        />
      </div>
      <div className="flex-1">
        <p className="text-[10px] text-text-muted">{label}</p>
        <input
          type="text"
          value={value || "#FFFFFF"}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-6 text-[11px] font-mono bg-surface-subtle border border-border rounded px-2 text-text"
        />
      </div>
    </div>
  );
}

export default function EditorRightSidebar({ editState, onUpdate, clip, transcript }) {
  const config = editState?.captionConfig || {
    fontSize: 120,
    fontName: "Poppins",
    fontWeight: 700,
    textColor: "#FFFFFF",
    highlightColor: "#00D4FF",
    outlineColor: "#000000",
    outlineWidth: 4,
    shadowColor: "#000000",
    shadowDepth: 3,
    verticalPct: 50,
    horizontalAlign: "center",
    maxWidthPct: 80,
    lineHeight: 1.3,
    maxLines: 2,
    letterSpacing: 0,
    animIn: 80,
    animOut: 80,
    highlightScale: 1.15,
    highlightBg: null,
    highlightRadius: 0,
    highlightGlow: false,
    highlightGlowColor: "#00D4FF",
    highlightGlowIntensity: 5,
  };

  const preset = editState?.captionPreset || "popup";
  const effectiveConfig = useMemo(() => getCaptionPresetStyle(preset, config), [preset, config]);

  const updateConfig = useCallback((key, value) => {
    onUpdate({ captionConfig: { ...config, [key]: value } });
  }, [config, onUpdate]);

  const previewWords = useMemo(() => {
    if (transcript?.segments && transcript.segments.length > 0) {
      const seg = transcript.segments[0];
      if (seg.words && seg.words.length > 0) {
        return seg.words.slice(0, 8).map((w) => w.word);
      }
      return (seg.text || "").split(/\s+/).slice(0, 8);
    }
    return ["Your", "captions", "will", "appear", "here"];
  }, [transcript]);

  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  useEffect(() => {
    if (!previewPlaying || previewWords.length === 0) return;
    const id = setInterval(() => {
      setPreviewIdx((prev) => (prev + 1) % previewWords.length);
    }, 300);
    return () => clearInterval(id);
  }, [previewPlaying, previewWords.length]);

  const handlePresetChange = useCallback((newPreset) => {
    const presetStyle = getCaptionPresetStyle(newPreset);
    onUpdate({
      captionPreset: newPreset,
      captionStyle: "popup",
      captionConfig: { ...config, ...presetStyle },
    });
    setPreviewIdx(0);
    setPreviewPlaying(true);
    setTimeout(() => setPreviewPlaying(false), 2000);
  }, [config, onUpdate]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold text-text uppercase tracking-wider">Caption Style</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Preview */}
        <div className="px-4 py-3 border-b border-border flex justify-center">
          <CaptionPreview
            words={previewWords}
            config={effectiveConfig}
            activeIndex={previewPlaying ? previewIdx : -1}
            playing={previewPlaying}
          />
        </div>

        {/* Presets */}
        <div className="border-b border-border px-4 py-3">
          <p className="text-[11px] text-text-secondary mb-2">Preset</p>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESET_LIST.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePresetChange(p.value)}
                className={cn(
                  "py-2 px-1.5 rounded-lg text-[10px] font-medium border transition-all text-center",
                  preset === p.value
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-surface-subtle text-text-secondary hover:text-text hover:border-border-strong"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <Section icon={Type} title="Typography" defaultOpen={true}>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-text-secondary mb-1.5">Font</p>
              <div className="grid grid-cols-2 gap-1.5">
                {FONTS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => updateConfig("fontName", f.value)}
                    className={cn(
                      "py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-all",
                      effectiveConfig.fontName === f.value
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-border bg-surface-subtle text-text-secondary hover:text-text"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <Slider
              value={effectiveConfig.fontSize}
              onChange={(v) => updateConfig("fontSize", v)}
              min={40}
              max={200}
              step={4}
              label="Font Size"
            />
            <Slider
              value={effectiveConfig.fontWeight}
              onChange={(v) => updateConfig("fontWeight", v)}
              min={300}
              max={900}
              step={100}
              label="Font Weight"
            />
            <Slider
              value={effectiveConfig.letterSpacing}
              onChange={(v) => updateConfig("letterSpacing", v)}
              min={-5}
              max={20}
              step={1}
              label="Letter Spacing"
            />
            <Slider
              value={effectiveConfig.lineHeight}
              onChange={(v) => updateConfig("lineHeight", v)}
              min={0.8}
              max={2.0}
              step={0.1}
              label="Line Height"
            />
          </div>
        </Section>

        <Section icon={Palette} title="Colors" defaultOpen={true}>
          <div className="space-y-3">
            <ColorInput label="Text Color" value={effectiveConfig.textColor} onChange={(v) => updateConfig("textColor", v)} />
            <ColorInput label="Highlight Color" value={effectiveConfig.highlightColor} onChange={(v) => updateConfig("highlightColor", v)} />
            <ColorInput label="Outline Color" value={effectiveConfig.outlineColor} onChange={(v) => updateConfig("outlineColor", v)} />
            <Slider
              value={effectiveConfig.outlineWidth}
              onChange={(v) => updateConfig("outlineWidth", v)}
              min={0}
              max={20}
              step={1}
              label="Outline Thickness"
            />
            <ColorInput label="Shadow Color" value={effectiveConfig.shadowColor} onChange={(v) => updateConfig("shadowColor", v)} />
            <Slider
              value={effectiveConfig.shadowDepth}
              onChange={(v) => updateConfig("shadowDepth", v)}
              min={0}
              max={20}
              step={1}
              label="Shadow Depth"
            />
          </div>
        </Section>

        <Section icon={Move} title="Position" defaultOpen={false}>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-text-secondary mb-1.5">Vertical Position</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[{ label: "Top", value: 80 }, { label: "Center", value: 50 }, { label: "Center Low", value: 35 }, { label: "Bottom", value: 15 }].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => updateConfig("verticalPct", opt.value)}
                    className={cn(
                      "py-2 px-3 rounded-lg text-[11px] font-medium border transition-all",
                      Math.abs(effectiveConfig.verticalPct - opt.value) < 5
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-border bg-surface-subtle text-text-secondary hover:text-text"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <Slider
              value={effectiveConfig.maxWidthPct}
              onChange={(v) => updateConfig("maxWidthPct", v)}
              min={40}
              max={95}
              step={1}
              label="Max Width"
              unit="%"
            />
          </div>
        </Section>

        <Section icon={Sparkles} title="Animation" defaultOpen={false}>
          <div className="space-y-3">
            <Slider
              value={effectiveConfig.animIn}
              onChange={(v) => updateConfig("animIn", v)}
              min={20}
              max={400}
              step={10}
              label="Pop-In Speed"
              unit="ms"
            />
            <Slider
              value={effectiveConfig.animOut}
              onChange={(v) => updateConfig("animOut", v)}
              min={20}
              max={400}
              step={10}
              label="Pop-Out Speed"
              unit="ms"
            />
            <Slider
              value={effectiveConfig.highlightScale}
              onChange={(v) => updateConfig("highlightScale", v)}
              min={1.0}
              max={1.5}
              step={0.05}
              label="Highlight Scale"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-secondary">Glow Effect</span>
              <button
                onClick={() => updateConfig("highlightGlow", !effectiveConfig.highlightGlow)}
                className={cn(
                  "w-9 h-5 rounded-full transition-all duration-200 relative",
                  effectiveConfig.highlightGlow ? "bg-primary" : "bg-surface-overlay"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                    effectiveConfig.highlightGlow ? "translate-x-[1.125rem]" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
