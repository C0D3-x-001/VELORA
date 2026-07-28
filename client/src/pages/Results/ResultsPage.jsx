import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Download, Play, Check, X, RotateCcw, Sparkles, Video, Film,
  Search, SlidersHorizontal, ArrowUpDown, Copy, CheckCircle2,
  Music, ChevronDown, AlertCircle, Crown, Lock, Clock, Flame, Pencil
} from "lucide-react";
import { useClips, useProject, useRegenerateClip, useUpdateCaptionStyle, useGenerateClips, useCredits } from "../../hooks/queries";
import Card from "../../components/ui/Card/Card";
import Badge from "../../components/ui/Badge/Badge";
import Button from "../../components/ui/Button/Button";
import Modal from "../../components/ui/Modal/Modal";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import { SkeletonResults } from "../../components/ui/Skeleton/Skeleton";
import { useToast } from "../../components/ui/Toast/Toast";
import { cn, formatDuration, getViralScoreColor, getErrorMessage } from "../../lib/utils";
import CaptionEditor from "../../components/ui/CaptionEditor/CaptionEditor";

const captionStyles = [
  { value: "popup", label: "Pop-Up", desc: "One word at a time, bounces with color emphasis" },
  { value: "bounce", label: "Bounce", desc: "Words bounce in with energy" },
  { value: "highlight", label: "Highlight", desc: "Full sentence, current word highlighted" },
  { value: "karaoke", label: "Karaoke", desc: "Words light up as spoken" },
  { value: "classic", label: "Classic", desc: "Entire sentence at once" },
  { value: "minimal", label: "Minimal", desc: "Simple clean subtitles" },
  { value: "none", label: "None", desc: "No captions" },
];

const SORT_OPTIONS = [
  { value: "score", label: "Viral Score" },
  { value: "duration", label: "Duration" },
  { value: "title", label: "Title" },
];

const SCORE_FILTERS = [
  { value: "all", label: "All Scores" },
  { value: "viral", label: "80+ Viral", min: 80 },
  { value: "high", label: "60+ High", min: 60 },
  { value: "good", label: "40+ Good", min: 40 },
];

function getPlatformLabel(score) {
  if (score >= 80) return { label: "All Platforms", variant: "success" };
  if (score >= 60) return { label: "TikTok / Reels", variant: "primary" };
  if (score >= 40) return { label: "YouTube Shorts", variant: "accent" };
  return { label: "Long-form", variant: "default" };
}

function getScoreRingColor(score) {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#5b3eff";
  if (score >= 40) return "#f59e0b";
  return "#686878";
}

async function handleDownload(clip) {
  const a = document.createElement("a");
  a.href = clip.video_url;
  a.download = `${clip.clip_metadata?.[0]?.title || clip.title || "clip"}.mp4`;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function CopyButton({ text, label, className }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-all duration-200",
        copied
          ? "bg-success/15 text-success"
          : "bg-surface-subtle text-text-secondary hover:text-text hover:bg-surface-overlay",
        className
      )}
      title={label}
    >
      {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function ViralScoreGauge({ score, size = 64, strokeWidth = 5 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreRingColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(42 42 58)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="animate-ring-draw"
          style={{ "--ring-offset": offset, filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

const ClipCard = memo(function ClipCard({ clip, index, onPreview, onOptions, onEdit, isRegenerating }) {
  const meta = clip.clip_metadata?.[0];
  const title = meta?.title || clip.title || `Clip ${index + 1}`;
  const platform = getPlatformLabel(clip.viral_score);
  const hashtags = meta?.hashtags || [];
  const captionText = meta?.caption || "";
  const copyText = [
    title,
    captionText,
    hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" "),
  ].filter(Boolean).join("\n\n");

  return (
    <Card
      className="overflow-hidden group relative glass-card glass-card-hover"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {isRegenerating && (
        <div className="absolute inset-0 z-20 bg-bg/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-primary">Regenerating...</p>
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative aspect-video bg-bg overflow-hidden">
        {clip.thumbnail_url ? (
          <>
            <img src={clip.thumbnail_url} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-subtle">
            <Film className="w-10 h-10 text-text-muted" />
          </div>
        )}

        {/* Viral score - top left */}
        {clip.viral_score != null && (
          <div className="absolute top-2.5 left-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
              <ViralScoreGauge score={clip.viral_score} size={22} strokeWidth={3} />
              <span className="text-xs font-bold text-white">{clip.viral_score}</span>
            </div>
          </div>
        )}

        {/* Duration - top right */}
        <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-sm text-[11px] font-mono font-medium px-2 py-1 rounded-md text-white border border-white/10">
          {formatDuration(clip.duration_seconds)}
        </div>

        {/* Play button - center */}
        <button
          onClick={() => onPreview(clip)}
          aria-label={`Preview ${title}`}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-white/25 transition-colors">
            <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <h3 className="text-sm font-semibold text-text line-clamp-2 flex-1 leading-snug">{title}</h3>
          <CopyButton text={title} label="Title" className="flex-shrink-0 mt-0.5" />
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <Badge variant={platform.variant} size="sm">{platform.label}</Badge>
          {clip.caption_style && clip.caption_style !== "none" && (
            <Badge variant="accent" size="sm">
              <Music className="w-2.5 h-2.5 mr-0.5" />
              {clip.caption_preset || clip.caption_style}
            </Badge>
          )}
        </div>

        {/* Caption preview */}
        {captionText && (
          <div className="mb-2.5">
            <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">{captionText}</p>
            <CopyButton text={captionText} label="Caption" className="mt-1.5" />
          </div>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1 mb-1.5">
              {hashtags.slice(0, 4).map((tag) => (
                <span key={tag} className="text-[10px] font-medium text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </span>
              ))}
              {hashtags.length > 4 && (
                <span className="text-[10px] text-text-muted">+{hashtags.length - 4}</span>
              )}
            </div>
            <CopyButton
              text={hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")}
              label="Hashtags"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => onEdit?.(clip)}>
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => handleDownload(clip)}>
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onOptions(clip)}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </Button>
          <CopyButton text={copyText} label="All" className="h-7" />
        </div>
      </div>
    </Card>
  );
});

export default function ResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(id);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const { data: clips, isLoading, error: clipsError } = useClips(id, {
    refetchInterval: regeneratingId ? 5000 : false,
  });
  const regenerate = useRegenerateClip();
  const updateCaption = useUpdateCaptionStyle();
  const retryMutation = useGenerateClips();
  const { data: creditsData } = useCredits();
  const { toast } = useToast();
  const isProOrAbove = ["pro", "business"].includes(creditsData?.plan);
  const [previewClip, setPreviewClip] = useState(null);
  const [selectedClip, setSelectedClip] = useState(null);
  const [captionModalOpen, setCaptionModalOpen] = useState(false);
  const [captionClipId, setCaptionClipId] = useState(null);
  const [ccEnabled, setCcEnabled] = useState(true);
  const [activeCaptionStyle, setActiveCaptionStyle] = useState("modern");
  const [captionConfig, setCaptionConfig] = useState({
    verticalPct: 50,
    fontSize: 40,
    fontName: "Poppins",
    fontWeight: 700,
    textColor: "#FFFFFF",
    highlightColor: "#FFD700",
    highlightBg: "rgba(255,215,0,0.2)",
    highlightRadius: 6,
    highlightGlow: false,
    highlightScale: 1.15,
    animIn: 80,
    animOut: 80,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [sortOpen, setSortOpen] = useState(false);
  const videoRef = useRef(null);

  const toggleCc = useCallback(() => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    if (tracks.length > 0) {
      const mode = ccEnabled ? "hidden" : "showing";
      tracks[0].mode = mode;
      setCcEnabled(!ccEnabled);
    }
  }, [ccEnabled]);

  const openCaptionModal = (clipId) => {
    const clip = clips?.find((c) => c.id === clipId);
    if (clip) {
      setActiveCaptionStyle(clip.caption_style || "modern");
      setCaptionConfig((prev) => {
        const saved = clip.caption_config;
        return saved && typeof saved === "object" ? { ...prev, ...saved } : prev;
      });
    }
    setCaptionClipId(clipId);
    setCaptionModalOpen(true);
  };

  const handleRegenerate = (clipId) => {
    setRegeneratingId(clipId);
    setSelectedClip(null);
    regenerate.mutate(
      { clipId, projectId: id, settings: {} },
      {
        onSuccess: () => {
          toast({ title: "Clip regeneration started", description: "Regenerating with fresh AI metadata...", type: "info" });
        },
        onError: (err) => {
          toast({ title: "Regeneration failed", description: getErrorMessage(err, "Could not regenerate this clip."), type: "error" });
          setRegeneratingId(null);
        },
      }
    );
  };

  useEffect(() => {
    if (!regeneratingId || !clips) return;
    const clip = clips.find((c) => c.id === regeneratingId);
    if (!clip) return;
    if (clip.status === "failed") {
      setRegeneratingId(null);
      toast({ title: "Regeneration failed", description: getErrorMessage("Clip regeneration failed. Credits have been refunded."), type: "error" });
    } else if (clip.status === "completed") {
      setRegeneratingId(null);
      toast({ title: "Regeneration complete", description: "Clip has been updated.", type: "success" });
    }
  }, [regeneratingId, clips, toast]);

  useEffect(() => {
    if (!regeneratingId) return;
    const timer = setTimeout(() => {
      setRegeneratingId(null);
      toast({ title: "Regeneration timed out", description: "Taking longer than expected. Refresh to check status.", type: "warning" });
    }, 90000);
    return () => clearTimeout(timer);
  }, [regeneratingId, toast]);

  const handleCaptionChange = (clipId, style, preset, position, config) => {
    updateCaption.mutate({ clipId, projectId: id, style, preset, position, captionConfig: config });
    setCaptionModalOpen(false);
  };

  useEffect(() => {
    if (retryMutation.isSuccess) {
      const timeout = setTimeout(() => navigate(`/dashboard/projects/${id}/processing`), 1000);
      return () => clearTimeout(timeout);
    }
  }, [retryMutation.isSuccess, id, navigate]);

  const filteredClips = useMemo(() => {
    if (!clips) return [];
    let result = [...clips];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => {
        const meta = c.clip_metadata?.[0];
        return (
          (meta?.title || c.title || "").toLowerCase().includes(q) ||
          (meta?.caption || "").toLowerCase().includes(q) ||
          (meta?.hashtags || []).some((h) => h.toLowerCase().includes(q))
        );
      });
    }

    if (scoreFilter !== "all") {
      const min = SCORE_FILTERS.find((f) => f.value === scoreFilter)?.min ?? 0;
      result = result.filter((c) => (c.viral_score || 0) >= min);
    }

    result.sort((a, b) => {
      if (sortBy === "score") return (b.viral_score || 0) - (a.viral_score || 0);
      if (sortBy === "duration") return (b.duration_seconds || 0) - (a.duration_seconds || 0);
      if (sortBy === "title") return (a.clip_metadata?.[0]?.title || a.title || "").localeCompare(b.clip_metadata?.[0]?.title || b.title || "");
      return 0;
    });

    return result;
  }, [clips, searchQuery, sortBy, scoreFilter]);

  const summaryStats = useMemo(() => {
    if (!clips?.length) return null;
    const avgScore = Math.round(clips.reduce((s, c) => s + (c.viral_score || 0), 0) / clips.length);
    const totalDuration = clips.reduce((s, c) => s + (c.duration_seconds || 0), 0);
    const viralCount = clips.filter((c) => (c.viral_score || 0) >= 80).length;
    return { avgScore, totalDuration, viralCount };
  }, [clips]);

  if (isLoading) return <SkeletonResults />;

  if (clipsError) {
    return (
      <EmptyState
        variant="danger"
        icon={<AlertCircle className="w-7 h-7" />}
        title="Failed to load clips"
        description={getErrorMessage(clipsError, "Something went wrong while loading your clips.")}
        action={{ onClick: () => window.location.reload(), children: "Retry" }}
        secondaryAction={{ onClick: () => navigate("/dashboard"), children: "Back to Dashboard" }}
      />
    );
  }

  if (!clips?.length) {
    const errorMsg = project?.error_message || null;
    return (
      <EmptyState
        icon={<Video className="w-8 h-8" />}
        title="No clips generated"
        description={errorMsg || "The AI couldn't generate clips from this video. This can happen if the video is too short, the audio couldn't be transcribed, or the upload failed. Try different settings or a different video."}
        action={{
          loading: retryMutation.isPending,
          disabled: retryMutation.isPending,
          onClick: () => retryMutation.mutate({ projectId: id, settings: project?.settings || {} }),
          children: <><RotateCcw className="w-4 h-4" /> {retryMutation.isPending ? "Retrying..." : "Retry Generation"}</>,
        }}
        secondaryAction={{ onClick: () => navigate("/dashboard/create"), children: "Create New Project" }}
      >
        {retryMutation.isSuccess && (
          <p className="text-success text-sm mt-4">Retry started! Redirecting...</p>
        )}
        {retryMutation.isError && (
          <p className="text-danger text-sm mt-4">{getErrorMessage(retryMutation.error, "Retry failed.")}</p>
        )}
      </EmptyState>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text truncate">{project?.title || "Generated Clips"}</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {clips.length} clip{clips.length !== 1 ? "s" : ""} ready
            {filteredClips.length !== clips.length && ` · ${filteredClips.length} shown`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="viral" size="md">{clips.length} clips</Badge>
          <Button variant="secondary" size="sm" className="h-8" onClick={() => navigate("/dashboard/create")}>
            Create More
          </Button>
        </div>
      </div>

      {/* Summary Stats Bar */}
      {summaryStats && (
        <Card className="glass-card p-4 sm:p-5 animate-fade-in" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center gap-6 sm:gap-8">
            {/* Average Viral Score */}
            <div className="flex items-center gap-3">
              <ViralScoreGauge score={summaryStats.avgScore} size={48} strokeWidth={4} />
              <div>
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Avg Score</p>
                <p className="text-lg font-bold text-text tabular-nums">{summaryStats.avgScore}</p>
              </div>
            </div>

            <div className="w-px h-10 bg-border" />

            {/* Total Duration */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Total Duration</p>
                <p className="text-lg font-bold text-text tabular-nums">{formatDuration(summaryStats.totalDuration)}</p>
              </div>
            </div>

            <div className="w-px h-10 bg-border hidden sm:block" />

            {/* Viral Clips */}
            <div className="items-center gap-2.5 hidden sm:flex">
              <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                <Flame className="w-4.5 h-4.5 text-success" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Viral (80+)</p>
                <p className="text-lg font-bold text-text tabular-nums">{summaryStats.viralCount}<span className="text-sm font-normal text-text-muted">/{clips.length}</span></p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clips..."
            className="w-full h-9 pl-9 pr-3 input-base text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="h-9 px-3 input-base text-sm text-text-secondary hover:text-text flex items-center gap-2"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{SORT_OPTIONS.find((o) => o.value === sortBy)?.label}</span>
            <ChevronDown className={cn("w-3 h-3 transition-transform", sortOpen && "rotate-180")} />
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-40 glass-card rounded-xl shadow-elevated py-1 animate-scale-in">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors",
                      sortBy === opt.value ? "text-primary bg-primary/5" : "text-text-secondary hover:text-text hover:bg-surface-subtle"
                    )}
                  >
                    {opt.label}
                    {sortBy === opt.value && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Score filter */}
        <div className="flex flex-wrap gap-1.5">
          {SCORE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setScoreFilter(f.value)}
              className={cn(
                "h-9 px-2.5 rounded-lg text-xs font-medium border transition-all duration-200",
                scoreFilter === f.value
                  ? "border-primary/30 bg-primary/10 text-primary shadow-sm shadow-primary/10"
                  : "border-border bg-surface-subtle text-text-secondary hover:text-text hover:border-border-strong"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clips Grid */}
      {filteredClips.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="No clips match your search"
          description="Try adjusting your search terms or clearing the active filters to see all clips."
          action={{ onClick: () => { setSearchQuery(""); setScoreFilter("all"); }, children: "Clear Filters" }}
          className="py-8"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClips.map((clip, i) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              index={i}
              onPreview={setPreviewClip}
              onOptions={setSelectedClip}
              onEdit={(c) => navigate(`/dashboard/projects/${id}/clips/${c.id}/edit`)}
              isRegenerating={regeneratingId === clip.id}
            />
          ))}
        </div>
      )}

      {/* Bottom action */}
      <div className="flex justify-center pt-3">
        <Button variant="secondary" onClick={() => navigate("/dashboard/create")} className="h-10">
          Create More Clips
        </Button>
      </div>

      {/* Preview Modal */}
      {previewClip && (
        <Modal isOpen={!!previewClip} onClose={() => setPreviewClip(null)} size="xl" title={previewClip.clip_metadata?.[0]?.title || previewClip.title}>
          <div className={cn("aspect-video bg-bg rounded-xl overflow-hidden relative", `caption-${activeCaptionStyle}`)}>
            {previewClip.video_url && !previewClip.video_url.includes("placeholder") ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  src={previewClip.video_url}
                  controls
                  className="w-full h-full object-contain"
                  poster={previewClip.thumbnail_url}
                >
                  {previewClip.subtitles_url && (
                    <track
                      kind="subtitles"
                      src={previewClip.subtitles_url}
                      srcLang="en"
                      label="English"
                      default={ccEnabled}
                    />
                  )}
                </video>
                {previewClip.subtitles_url && (
                  <button
                    onClick={toggleCc}
                    className={cn(
                      "absolute top-3 right-3 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors backdrop-blur-sm",
                      ccEnabled ? "bg-primary/90 text-white" : "bg-black/40 text-white/60 hover:bg-black/60"
                    )}
                  >
                    CC {ccEnabled ? "ON" : "OFF"}
                  </button>
                )}
              </div>
            ) : previewClip.thumbnail_url ? (
              <div className="w-full h-full relative">
                <img src={previewClip.thumbnail_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
                    <Play className="w-8 h-8 text-white ml-0.5" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="w-12 h-12 text-text-muted" />
              </div>
            )}
          </div>

          {/* Caption styles */}
          {previewClip.subtitles_url && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <span className="text-[11px] text-text-muted mr-1">Style:</span>
              {captionStyles.map((cs) => (
                <button
                  key={cs.value}
                  onClick={() => {
                    setActiveCaptionStyle(cs.value);
                    if (cs.value === "none") {
                      setCcEnabled(false);
                      if (videoRef.current?.textTracks[0]) videoRef.current.textTracks[0].mode = "hidden";
                    } else if (!ccEnabled) {
                      setCcEnabled(true);
                      if (videoRef.current?.textTracks[0]) videoRef.current.textTracks[0].mode = "showing";
                    }
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 capitalize",
                    activeCaptionStyle === cs.value
                      ? "bg-primary text-white shadow-sm shadow-primary/20"
                      : "bg-surface-subtle text-text-secondary hover:text-text hover:bg-surface-overlay"
                  )}
                >
                  {cs.label}
                </button>
              ))}
            </div>
          )}

          {/* Clip info */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <ViralScoreGauge score={previewClip.viral_score} size={28} strokeWidth={3} />
                <span className={cn("text-sm font-bold", getViralScoreColor(previewClip.viral_score))}>
                  {previewClip.viral_score}
                </span>
              </div>
              <span className="text-text-muted">·</span>
              <span className="text-sm text-text-secondary">{formatDuration(previewClip.duration_seconds)}</span>
              <span className="text-text-muted">·</span>
              <Badge variant={getPlatformLabel(previewClip.viral_score).variant} size="sm">
                {getPlatformLabel(previewClip.viral_score).label}
              </Badge>
            </div>
            {previewClip.clip_metadata?.[0]?.caption && (
              <p className="text-sm text-text-secondary">{previewClip.clip_metadata[0].caption}</p>
            )}
            {previewClip.clip_metadata?.[0]?.hashtags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {previewClip.clip_metadata[0].hashtags.map((t) => (
                  <span key={t} className="text-xs font-medium text-primary/80 bg-primary/10 px-2 py-0.5 rounded">
                    {t.startsWith("#") ? t : `#${t}`}
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" size="sm" className="h-8" onClick={() => handleDownload(previewClip)}>
                <Download className="w-3.5 h-3.5" /> Download
              </Button>
              <CopyButton
                text={[
                  previewClip.clip_metadata?.[0]?.title || previewClip.title || "",
                  previewClip.clip_metadata?.[0]?.caption || "",
                  (previewClip.clip_metadata?.[0]?.hashtags || []).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" "),
                ].filter(Boolean).join("\n\n")}
                label="Copy All"
                className="h-8"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Options Modal */}
      {selectedClip && (
        <Modal isOpen={!!selectedClip} onClose={() => setSelectedClip(null)} title="Clip Options" size="sm">
          <div className="space-y-1.5">
            <Button className="w-full justify-start h-10" variant="ghost" onClick={() => { setSelectedClip(null); navigate(`/dashboard/projects/${id}/clips/${selectedClip.id}/edit`); }}>
              <Pencil className="w-4 h-4 mr-2" /> Edit Clip
            </Button>
            <Button className="w-full justify-start h-10" variant="ghost" onClick={() => { handleDownload(selectedClip); setSelectedClip(null); }}>
              <Download className="w-4 h-4 mr-2" /> Download Video
            </Button>
            <Button
              className="w-full justify-start h-10"
              variant="ghost"
              loading={regeneratingId === selectedClip.id}
              disabled={regeneratingId != null}
              onClick={() => handleRegenerate(selectedClip.id)}
            >
              <RotateCcw className="w-4 h-4 mr-2" /> {regeneratingId === selectedClip.id ? "Regenerating..." : "Regenerate Clip"}
            </Button>
            <Button className="w-full justify-start h-10" variant="ghost" onClick={() => { setSelectedClip(null); openCaptionModal(selectedClip.id); }}>
              <Sparkles className="w-4 h-4 mr-2" /> Change Caption Style
            </Button>
            <div className="pt-2 mt-2 border-t border-border">
              <CopyButton
                text={[
                  selectedClip.clip_metadata?.[0]?.title || selectedClip.title || "",
                  selectedClip.clip_metadata?.[0]?.caption || "",
                  (selectedClip.clip_metadata?.[0]?.hashtags || []).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" "),
                ].filter(Boolean).join("\n\n")}
                label="Copy Title, Caption & Hashtags"
                className="w-full justify-center h-9"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Caption Style Modal */}
      {captionModalOpen && (
        <Modal isOpen={captionModalOpen} onClose={() => setCaptionModalOpen(false)} title="Caption Style" size="sm">
          <div className="space-y-3">
            <div className="space-y-2">
              {captionStyles.map((cs) => (
                  <button
                    key={cs.value}
                    onClick={() => {
                      setActiveCaptionStyle(cs.value);
                    }}
                    className={cn(
                      "w-full p-3 rounded-xl border-2 text-left transition-all duration-200",
                      cs.value === activeCaptionStyle
                        ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                        : "border-border hover:border-primary/30 hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-text capitalize">{cs.label}</span>
                      </div>
                      {activeCaptionStyle === cs.value && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-[11px] text-text-secondary">{cs.desc}</p>
                  </button>
                ))}
            </div>

            {activeCaptionStyle !== "none" && (
              <>
                <CaptionEditor value={captionConfig} onChange={setCaptionConfig} />
              </>
            )}

            <button
              onClick={() => {
                const clip = clips?.find((c) => c.id === captionClipId);
                handleCaptionChange(captionClipId, activeCaptionStyle, clip?.caption_preset || "", clip?.caption_position || "", captionConfig);
              }}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover shadow-button shadow-primary/20 transition-all duration-200 mt-2"
            >
              Apply & Regenerate
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
