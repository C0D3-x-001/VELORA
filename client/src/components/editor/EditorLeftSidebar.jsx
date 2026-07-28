import { useState } from "react";
import { Music, Type, Clock, FileText, ChevronDown, ChevronRight } from "lucide-react";
import Slider from "../ui/Slider/Slider";
import { cn, formatDuration } from "../../lib/utils";
import { PRESET_LIST, getCaptionPresetStyle } from "../../lib/captionPresets";

const RESOLUTION_OPTIONS = [
  { value: "1080x1920", label: "9:16 Vertical", desc: "TikTok, Reels, Shorts" },
  { value: "1280x720", label: "16:9 Landscape", desc: "YouTube, general" },
  { value: "1080x1080", label: "1:1 Square", desc: "Instagram, Facebook" },
  { value: "720x1280", label: "9:16 Small", desc: "Lower resolution vertical" },
];

const BITRATE_OPTIONS = [
  { value: "high", label: "High", desc: "~8 Mbps" },
  { value: "medium", label: "Medium", desc: "~5 Mbps" },
  { value: "low", label: "Low", desc: "~2 Mbps" },
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

export default function EditorLeftSidebar({ clip, transcript, editState, onUpdate, duration }) {
  const captionConfig = editState?.captionConfig || {};
  const captionPreset = editState?.captionPreset || "classic";
  const exportSettings = editState?.exportSettings || { resolution: "1080x1920", fps: 30, bitrate: "high" };
  const meta = clip?.clip_metadata?.[0];

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold text-text uppercase tracking-wider">Clip Info</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Section icon={FileText} title="Details" defaultOpen={true}>
          <div className="space-y-2">
            <div>
              <p className="text-[11px] text-text-muted">Title</p>
              <p className="text-sm text-text font-medium truncate">{meta?.title || clip.title || "Untitled"}</p>
            </div>
            <div className="flex gap-3">
              <div>
                <p className="text-[11px] text-text-muted">Duration</p>
                <p className="text-sm text-text font-mono">{formatDuration(duration)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted">Score</p>
                <p className="text-sm text-text font-mono">{clip.viral_score || "—"}</p>
              </div>
            </div>
            {meta?.caption && (
              <div>
                <p className="text-[11px] text-text-muted">Caption</p>
                <p className="text-[11px] text-text-secondary line-clamp-3">{meta.caption}</p>
              </div>
            )}
          </div>
        </Section>

        <Section icon={Music} title="Caption Preset" defaultOpen={false}>
          <div className="space-y-1.5">
            {PRESET_LIST.map((preset) => (
              <button
                key={preset.value}
                onClick={() => {
                  const presetStyle = getCaptionPresetStyle(preset.value);
                  onUpdate({
                    captionPreset: preset.value,
                    captionStyle: "classic",
                    captionConfig: { ...captionConfig, ...presetStyle },
                  });
                }}
                className={cn(
                  "w-full p-2.5 rounded-lg text-left transition-all duration-200 border",
                  captionPreset === preset.value
                    ? "border-primary/40 bg-primary/5 text-text"
                    : "border-transparent bg-surface-subtle/50 text-text-secondary hover:bg-surface-subtle hover:text-text"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{preset.label}</span>
                  {captionPreset === preset.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>
              </button>
            ))}
          </div>
        </Section>

        <Section icon={Clock} title="Transcript" defaultOpen={false}>
          {transcript?.segments?.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {transcript.segments.map((seg, i) => (
                <div key={i} className="text-[11px]">
                  <span className="text-primary font-mono">{formatDuration(seg.start)}</span>
                  <span className="text-text-secondary ml-2">{seg.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-text-muted">No transcript available</p>
          )}
        </Section>

        <Section icon={Type} title="Export Settings" defaultOpen={false}>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-medium text-text-secondary mb-2">Resolution</p>
              <div className="space-y-1.5">
                {RESOLUTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onUpdate({ exportSettings: { ...exportSettings, resolution: opt.value } })}
                    className={cn(
                      "w-full p-2 rounded-lg text-left text-xs transition-all border",
                      exportSettings.resolution === opt.value
                        ? "border-primary/40 bg-primary/5 text-text"
                        : "border-transparent bg-surface-subtle/50 text-text-secondary hover:bg-surface-subtle"
                    )}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-text-muted ml-1.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <Slider
              value={exportSettings.fps || 30}
              onChange={(v) => onUpdate({ exportSettings: { ...exportSettings, fps: v } })}
              min={24}
              max={60}
              step={1}
              label="FPS"
            />
            <div>
              <p className="text-[11px] font-medium text-text-secondary mb-2">Bitrate</p>
              <div className="flex gap-1.5">
                {BITRATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onUpdate({ exportSettings: { ...exportSettings, bitrate: opt.value } })}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                      exportSettings.bitrate === opt.value
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-border bg-surface-subtle text-text-secondary hover:text-text"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
