import { useState, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, X, Link2, Upload,
  Clock, AlertCircle, FileVideo, Globe, Sparkles, Shield, Info, AlertTriangle,
  CheckCircle, XCircle, Crown, Lock
} from "lucide-react";
import { useUser } from "../../lib/auth";
import { useCreateProject, useGenerateClips, useCredits, usePricing, useSettings } from "../../hooks/queries";
import { formatCredits, formatDuration, calculateCredits, cn, getErrorMessage, formatNumber } from "../../lib/utils";
import { validateClipSettings } from "../../lib/clipValidation";
import api from "../../lib/api";
import Button from "../../components/ui/Button/Button";
import Card from "../../components/ui/Card/Card";
import Badge from "../../components/ui/Badge/Badge";
import Input from "../../components/ui/Input/Input";
import Spinner from "../../components/ui/Spinner/Spinner";
import Modal from "../../components/ui/Modal/Modal";
import Slider from "../../components/ui/Slider/Slider";


const YOUTUBE_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)[\w-]{11}(?:\S*)?$/;

const ACCEPTED_FORMATS = [
  { ext: "MP4", mime: "video/mp4" },
  { ext: "MOV", mime: "video/quicktime" },
  { ext: "MKV", mime: "video/x-matroska" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024;
const MAX_DURATION_SECONDS = 3 * 3600;

const CLIP_DURATION_OPTIONS = [
  { value: 15, label: "15s", desc: "Ultra-short hooks" },
  { value: 30, label: "30s", desc: "Quick hooks, high retention" },
  { value: 45, label: "45s", desc: "Balanced storytelling" },
  { value: 60, label: "60s", desc: "Standard short-form" },
  { value: 90, label: "90s", desc: "Deeper storytelling" },
  { value: 120, label: "120s", desc: "Long-form clips" },
  { value: null, label: "AI Optimized", desc: "AI picks best length per clip", pro: true },
];

const CLIP_COUNT_OPTIONS = [3, 5, 10, 15, 20];

const steps = [
  { id: "source", title: "Video Source", desc: "Choose how to add your video" },
  { id: "preview", title: "Preview", desc: "Confirm video details" },
  { id: "settings", title: "Settings", desc: "Customize your clips" },
  { id: "confirm", title: "Confirm", desc: "Review & generate" },
];

const platforms = [
  { value: "vertical", label: "Vertical (9:16)", icon: "📱" },
  { value: "landscape", label: "Landscape (16:9)", icon: "🖥️" },
];

const captionStyles = [
  { value: "popup", label: "Pop-Up", desc: "One word at a time, pop-up animation", pro: true },
  { value: "bounce", label: "Bounce", desc: "Words bounce in with energy", pro: true },
  { value: "highlight", label: "Highlight", desc: "Full sentence, current word highlighted", pro: true },
  { value: "karaoke", label: "Karaoke", desc: "Words light up as spoken", pro: true },
  { value: "classic", label: "Classic", desc: "Entire sentence at once", pro: true },
  { value: "minimal", label: "Minimal", desc: "Simple clean subtitles", pro: true },
];

const captionPositions = [
  { value: "upper", label: "Top" },
  { value: "center", label: "Center" },
  { value: "center-low", label: "Center-Low" },
  { value: "lower", label: "Bottom" },
];

const closeUpModes = [
  { value: "closeup", label: "Close-Up", desc: "Face fills 70-80% of frame. Perfect for TikTok." },
  { value: "medium", label: "Medium", desc: "Shows head and shoulders." },
  { value: "wide", label: "Wide", desc: "Shows upper body with more background." },
];

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((s, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-all duration-200",
                  isComplete && "bg-primary text-white",
                  isCurrent && "bg-primary/15 text-primary ring-2 ring-primary/30",
                  !isComplete && !isCurrent && "bg-surface-overlay text-text-muted"
                )}
              >
                {isComplete ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={cn(
                "text-[11px] font-medium hidden sm:block transition-colors",
                isCurrent ? "text-primary" : isComplete ? "text-text-secondary" : "text-text-muted"
              )}>
                {s.title}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-[2px] mx-2 sm:mx-3 rounded-full transition-colors duration-300 mt-0 sm:-mt-4",
                i < currentStep ? "bg-primary" : "bg-surface-overlay"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepHeader({ step }) {
  return (
    <div className="space-y-1">
      <h2 className="text-base sm:text-lg font-semibold text-text">{steps[step].title}</h2>
      <p className="text-xs sm:text-sm text-text-secondary">{steps[step].desc}</p>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }) {
  return (
    <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-3 animate-slide-down">
      <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
      <p className="text-sm text-danger flex-1">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-danger/50 hover:text-danger transition-colors p-0.5" aria-label="Dismiss error">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function SourceTypeCard({ selected, icon: Icon, label, desc, formats, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-2.5 p-5 sm:p-6 rounded-xl border-2 transition-all duration-200 text-center",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-surface hover:border-border hover:bg-surface-hover"
      )}
    >
      <div className={cn(
        "w-11 h-11 rounded-lg flex items-center justify-center transition-colors",
        selected ? "bg-primary/15 text-primary" : "bg-surface-overlay text-text-secondary"
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
      </div>
      {formats && (
        <div className="flex gap-1.5">
          {formats.map((f) => (
            <span key={f} className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-surface-overlay text-text-muted">{f}</span>
          ))}
        </div>
      )}
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
}

function DropZone({ onFile, disabled }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items?.length > 0) setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }, [disabled, onFile]);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <input
          type="file"
          accept={ACCEPTED_FORMATS.map((f) => f.mime).join(",")}
          onChange={handleChange}
          disabled={disabled}
          className="hidden"
          id="video-upload"
        />
        <div
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 sm:p-10 text-center transition-all duration-200 cursor-pointer overflow-hidden",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/40 hover:bg-surface-hover",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-primary/5 animate-pulse-soft pointer-events-none" />
          )}
          <div className={cn(
            "w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center transition-colors",
            isDragging ? "bg-primary/15 text-primary" : "bg-surface-overlay text-text-secondary"
          )}>
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-text mb-1">
            {isDragging ? "Drop your video here" : "Drag & drop your video here"}
          </p>
          <p className="text-xs text-text-secondary mb-3">
            or <span className="text-primary font-medium">click to browse</span>
          </p>
          <div className="flex items-center justify-center gap-2 text-[11px] text-text-muted">
            <span className="font-mono font-medium">{MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB</span>
            <span>·</span>
            <span>{MAX_DURATION_SECONDS / 3600}h max</span>
            <span>·</span>
            <span>{ACCEPTED_FORMATS.map((f) => f.ext).join(", ")}</span>
          </div>
        </div>
      </label>
    </div>
  );
}

export default function CreateProjectPage() {
  const navigate = useNavigate();
  useUser();
  const createMutation = useCreateProject();
  const generateMutation = useGenerateClips();
  const { data: creditsData } = useCredits();
  const { data: serverSettings } = useSettings();
  const [step, setStep] = useState(0);
  const [sourceType, setSourceType] = useState("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [urlTouched, setUrlTouched] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);
  const [clipCount, setClipCount] = useState(5);
  const [customClipCount, setCustomClipCount] = useState("");
  const [showCustomClipCount, setShowCustomClipCount] = useState(false);
  const [clipDuration, setClipDuration] = useState(30);
  const [customClipDuration, setCustomClipDuration] = useState("");
  const [showCustomClipDuration, setShowCustomClipDuration] = useState(false);
  const [platform, setPlatform] = useState("vertical");
  const [captionStyle, setCaptionStyle] = useState("popup");
  const [captionPreset, setCaptionPreset] = useState("popup");
  const [captionPosition, setCaptionPosition] = useState("center");
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
const [captionsEnabled, setCaptionsEnabled] = useState(true);
const [stabilization, setStabilization] = useState(true);
const [faceTracking, setFaceTracking] = useState(true);
const [autoReframe, setAutoReframe] = useState(true);
const [closeUpFraming, setCloseUpFraming] = useState(false);
const [closeUpMode, setCloseUpMode] = useState("closeup");
const [autoPunchIn, setAutoPunchIn] = useState(false);
const [autoSpeakerSwitch, setAutoSpeakerSwitch] = useState(true);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState(null);
  const [generateStep, setGenerateStep] = useState(null);
  const [setupWarning, setSetupWarning] = useState(null);

  useEffect(() => {
    api.get("/health/setup").then((data) => {
      if (!data.cookies) setSetupWarning("YouTube downloads require authentication. Add cookies.txt to the server/ directory (export from browser) or YouTube will block requests.");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (serverSettings) {
      setPlatform(serverSettings.default_platform || "vertical");
      const savedStyle = serverSettings.default_caption_style || "popup";
      const validPresets = ["popup", "bounce", "highlight", "karaoke", "classic", "minimal"];
      const mappedPreset = serverSettings.default_caption_preset || (validPresets.includes(savedStyle) ? savedStyle : "popup");
      setCaptionStyle("popup");
      setCaptionPreset(mappedPreset);
      setStabilization(serverSettings.default_stabilization ?? true);
      setFaceTracking(serverSettings.default_face_tracking ?? true);
      setAutoReframe(serverSettings.default_auto_reframe ?? true);
      setCloseUpFraming(serverSettings.default_close_up_framing ?? false);
      setCloseUpMode(serverSettings.default_close_up_mode || "closeup");
      setAutoPunchIn(serverSettings.default_auto_punch_in ?? false);
      setAutoSpeakerSwitch(serverSettings.default_auto_speaker_switch ?? true);
    }
  }, [serverSettings]);

  const userCredits = creditsData?.balance ?? 0;
  const { data: pricing } = usePricing();
  const isAiOptimized = clipDuration == null;
  const estimatedCredits = isAiOptimized
    ? calculateCredits({ clipCount, clipDuration: 120 }, pricing)
    : calculateCredits({ clipCount, clipDuration }, pricing);
  const canAfford = userCredits >= estimatedCredits;
  const isProcessing = createMutation.isPending || generateMutation.isPending;

  const isUrlValid = YOUTUBE_REGEX.test(youtubeUrl.trim());
  const urlError = urlTouched && youtubeUrl && !isUrlValid ? "Please enter a valid YouTube URL" : "";
  const canContinueYouTube = isUrlValid && !validating;
  const progress = Math.round(((step + 1) / steps.length) * 100);

  // Smart warnings
  const effectiveDuration = clipDuration == null
    ? null
    : showCustomClipDuration ? parseInt(customClipDuration, 10) || clipDuration : clipDuration;
  const effectiveClipCount = showCustomClipCount ? parseInt(customClipCount, 10) || clipCount : clipCount;

  // Clip Validation
  const [clipValidation, setClipValidation] = useState(null);

  useEffect(() => {
    if (videoInfo?.duration && videoInfo.duration > 0 && effectiveDuration != null) {
      const validation = validateClipSettings(
        videoInfo.duration,
        effectiveDuration,
        effectiveClipCount
      );
      setClipValidation(validation);
    } else if (isAiOptimized) {
      setClipValidation(null);
    } else {
      setClipValidation(null);
    }
  }, [videoInfo?.duration, effectiveDuration, effectiveClipCount]);

  const isProOrAbove = ["pro", "business"].includes(creditsData?.plan);

  const handleCaptionStyleSelect = (style) => {
    const def = captionStyles.find((cs) => cs.value === style);
    if (def?.pro && !isProOrAbove) {
      setShowPremiumModal(true);
      return;
    }
    setCaptionStyle("popup");
    setCaptionPreset(style);
    if (!captionsEnabled) setCaptionsEnabled(true);
  };

  // Smart warnings
  const isHighWorkload = effectiveClipCount * effectiveDuration > 1200;
  const isVeryHighWorkload = effectiveClipCount * effectiveDuration > 2400;

  const goNext = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const goBack = () => { setError(null); setStep((s) => Math.max(s - 1, 0)); };

  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    if (!isUrlValid) {
      setUrlTouched(true);
      return;
    }
    setError(null);
    setValidating(true);
    try {
      const info = await api.get(`/projects/validate-youtube?url=${encodeURIComponent(youtubeUrl)}`);
      setVideoInfo({
        title: info.title || "YouTube Video",
        duration: info.duration || 0,
        thumbnail: info.thumbnail || null,
        author: info.author || null,
        format: info.format || null,
      });
      goNext();
    } catch (err) {
      setError(getErrorMessage(err, "Could not fetch video info. Check the URL and try again."));
    } finally {
      setValidating(false);
    }
  };

  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    const validExts = ["mp4", "mov", "mkv"];
    if (!validExts.includes(ext)) {
      setError(`Invalid file format. Accepted: ${ACCEPTED_FORMATS.map((f) => f.ext).join(", ")}`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB.`);
      return;
    }
    setError(null);
    setVideoFile(file);
    const name = file.name.replace(/\.[^/.]+$/, "");
    setVideoInfo({
      title: name,
      duration: 0,
      size: file.size,
      thumbnail: null,
    });
    goNext();
  }, []);

  const handleGenerate = async () => {
    setError(null);
    setGenerateStep("Creating project...");
    try {
      const result = await createMutation.mutateAsync({
        title: videoInfo?.title || "Untitled Project",
        source: sourceType,
        url: sourceType === "youtube" ? youtubeUrl : null,
      });

      const projectId = result?.projectId || result?.id;
      if (!projectId) throw new Error("Failed to create project");

      if (sourceType === "upload" && videoFile) {
        setGenerateStep("Uploading video...");
        const formData = new FormData();
        formData.append("video", videoFile);
        await api.post(`/projects/${projectId}/upload`, formData);
      }

      setGenerateStep("Starting AI processing...");
      await generateMutation.mutateAsync({
        projectId,
        settings: { clipCount: effectiveClipCount, clipDuration: effectiveDuration, platform, captionStyle: captionsEnabled ? captionStyle : "none", captionPreset, captionPosition, captionConfig, captionsEnabled, stabilization, faceTracking, autoReframe, closeUpFraming, closeUpMode, autoPunchIn, autoSpeakerSwitch },
      });

      navigate(`/dashboard/projects/${projectId}/processing`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to start generation. Please try again."));
      setGenerateStep(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + Progress */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-8 -ml-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-1.5 rounded-full bg-surface-overlay overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-[11px] font-mono font-medium text-text-muted tabular-nums">{progress}%</span>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={step} />

      {/* Step Header */}
      <StepHeader step={step} />

      {/* Error */}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Step Content */}
      <Card className="p-5 sm:p-6">
        {/* Step 0: Source */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <SourceTypeCard
                selected={sourceType === "youtube"}
                icon={Link2}
                label="YouTube URL"
                desc="Paste a video link"
                onClick={() => { setSourceType("youtube"); setError(null); setUrlTouched(false); }}
              />
              <SourceTypeCard
                selected={sourceType === "upload"}
                icon={Upload}
                label="Upload File"
                desc="Drag & drop or browse"
                formats={ACCEPTED_FORMATS.map((f) => f.ext)}
                onClick={() => { setSourceType("upload"); setError(null); }}
              />
            </div>

            {sourceType === "youtube" && setupWarning && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-yellow-300 text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{setupWarning}</span>
              </div>
            )}

            {sourceType === "youtube" && (
              <form onSubmit={handleYoutubeSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">YouTube URL</label>
                  <div className="relative">
                    <Input
                      value={youtubeUrl}
                      onChange={(e) => { setYoutubeUrl(e.target.value); setUrlTouched(true); }}
                      onBlur={() => setUrlTouched(true)}
                      placeholder="https://youtube.com/watch?v=..."
                      disabled={validating}
                      className={cn(
                        urlTouched && youtubeUrl && !isUrlValid && "border-danger/50 focus:border-danger/50 focus:ring-danger/20",
                        urlTouched && youtubeUrl && isUrlValid && "border-success/50 focus:border-success/50 focus:ring-success/20"
                      )}
                    />
                    {urlTouched && youtubeUrl && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isUrlValid ? (
                          <div className="w-5 h-5 rounded-full bg-success/15 flex items-center justify-center">
                            <Check className="w-3 h-3 text-success" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-danger/15 flex items-center justify-center">
                            <X className="w-3 h-3 text-danger" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {urlError && <p className="text-xs text-danger mt-1.5">{urlError}</p>}
                  {!urlTouched && (
                    <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Supports YouTube, YouTube Shorts, and youtu.be links
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={!canContinueYouTube}
                  className="w-full h-11"
                  loading={validating}
                >
                  {validating ? "Analyzing..." : "Validate & Continue"}
                  {!validating && <ArrowRight className="w-4 h-4" />}
                </Button>
              </form>
            )}

            {sourceType === "upload" && (
              <div className="space-y-3">
                <DropZone onFile={handleFileUpload} disabled={isProcessing} />
                <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-subtle">
                  <Shield className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Your video is encrypted in transit and deleted after processing. We never share your content.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Preview */}
        {step === 1 && videoInfo && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-44 aspect-video sm:aspect-[4/3] flex-shrink-0 rounded-xl bg-surface-subtle border border-border overflow-hidden relative">
                {videoInfo.thumbnail ? (
                  <img src={videoInfo.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted">
                    <FileVideo className="w-8 h-8" />
                  </div>
                )}
                {videoInfo.duration > 0 && (
                  <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-sm text-[11px] font-mono font-medium px-1.5 py-0.5 rounded text-white">
                    {formatDuration(videoInfo.duration)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-text truncate">{videoInfo.title}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs text-text-secondary">
                  {videoInfo.duration > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {formatDuration(videoInfo.duration)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    {sourceType === "youtube" ? <Globe className="w-3.5 h-3.5" /> : <FileVideo className="w-3.5 h-3.5" />}
                    {sourceType === "youtube" ? "YouTube" : formatFileSize(videoInfo.size)}
                  </span>
                  {videoInfo.author && <span>by {videoInfo.author}</span>}
                </div>
                {videoInfo.duration > 0 && (
                  <div className="mt-3 p-2.5 rounded-lg bg-surface-subtle">
                    <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                      <Clock className="w-3 h-3 text-primary" />
                      <span>Estimated processing: <span className="font-medium text-text">{estimateProcessingTime(videoInfo.duration)}</span></span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button variant="secondary" onClick={goBack} className="flex-1 h-11">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={goNext} className="flex-1 h-11">
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Settings */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Live Credit Estimation */}
            <Card className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-text">Live Estimate</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-3 rounded-lg bg-surface">
                  <p className="text-2xl sm:text-3xl font-bold text-text tabular-nums">{effectiveClipCount}</p>
                  <p className="text-[11px] text-text-secondary">Clips</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-surface">
                  <p className="text-2xl sm:text-3xl font-bold text-text tabular-nums">{isAiOptimized ? "AI" : `${effectiveDuration}s`}</p>
                  <p className="text-[11px] text-text-secondary">{isAiOptimized ? "AI Picks" : "Per Clip"}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-surface">
                  <p className="text-2xl sm:text-3xl font-bold text-highlight tabular-nums">{estimatedCredits}</p>
                  <p className="text-[11px] text-text-secondary">Credits</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-surface">
                  <p className="text-2xl sm:text-3xl font-bold text-text tabular-nums">
                    {isAiOptimized ? "Varies" : estimateProcessingTime(effectiveClipCount * effectiveDuration)}
                  </p>
                  <p className="text-[11px] text-text-secondary">Est. Time</p>
                </div>
              </div>
              {/* Smart Warnings */}
              {!isAiOptimized && effectiveClipCount * effectiveDuration > 1800 && (
                <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-warning">
                    <p className="font-medium">High workload detected</p>
                    <p className="mt-0.5">This configuration may take longer to process and will consume more credits.</p>
                  </div>
                </div>
              )}
              {!isAiOptimized && effectiveClipCount > 15 && effectiveDuration > 90 && (
                <div className="mt-3 p-3 rounded-lg bg-info/10 border border-info/20 flex items-start gap-2">
                  <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-info">
                    <p className="font-medium">Quality priority</p>
                    <p className="mt-0.5">Generating many long clips — AI will prioritize quality over quantity if high-scoring moments are limited.</p>
                  </div>
                </div>
              )}
            </Card>

            {/* Clip Validation Engine */}
            {clipValidation && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    clipValidation.status === "impossible" && "bg-danger",
                    clipValidation.status === "warning" && "bg-warning",
                    clipValidation.status === "ideal" && "bg-success",
                    clipValidation.status === "info" && "bg-info"
                  )} />
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Clip Validation Engine
                  </span>
                </div>

                {/* Case 1: Impossible - clip duration > video length */}
                {clipValidation.status === "impossible" && (
                  <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 space-y-2">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-danger">Configuration Impossible</p>
                        <p className="text-xs text-text-secondary mt-1">
                          {clipValidation.issues?.map((issue, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <span className="text-danger">•</span>
                              <span>{issue}</span>
                            </div>
                          ))}
                        </p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-overlay">
                      <p className="text-xs text-text-secondary">
                        <strong>Source video:</strong> {formatDuration(clipValidation.videoLength)}<br/>
                        <strong>Requested clip duration:</strong> {clipValidation.requestedClipLength}s
                      </p>
                    </div>
                    {clipValidation.recommendations && clipValidation.recommendations.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const rec = clipValidation.recommendations[0];
                          if (rec.clipDuration) setClipDuration(rec.clipDuration);
                          if (rec.clipCount) setClipCount(rec.clipCount);
                          setShowCustomClipDuration(false);
                          setShowCustomClipCount(false);
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        Use Recommended Settings
                      </Button>
                    )}
                  </div>
                )}

                {/* Case 2/3/4: Warning - unrealistic but possible */}
                {clipValidation.status === "warning" && (
                  <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-warning">Unrealistic Configuration</p>
                        <p className="text-xs text-text-secondary mt-1">
                          {clipValidation.issues?.map((issue, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <span className="text-warning">•</span>
                              <span>{issue}</span>
                            </div>
                          ))}
                        </p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-overlay space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Source video:</span>
                        <span className="font-medium">{formatDuration(clipValidation.videoLength)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Total requested clip time:</span>
                        <span className="font-medium text-warning">{formatDuration(clipValidation.totalRequestedSeconds || 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Available source time:</span>
                        <span className="font-medium">{formatDuration(clipValidation.videoLength)}</span>
                      </div>
                      {clipValidation.estimatedRealisticClips && (
                        <div className="flex justify-between text-xs border-t border-border pt-2">
                          <span className="text-text-secondary">Realistic clip count:</span>
                          <span className="font-medium text-info">{clipValidation.estimatedRealisticClips} clips</span>
                        </div>
                      )}
                    </div>
                    {clipValidation.recommendations && clipValidation.recommendations.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const rec = clipValidation.recommendations[0];
                          if (rec.clipDuration) setClipDuration(rec.clipDuration);
                          if (rec.clipCount) setClipCount(rec.clipCount);
                          setShowCustomClipDuration(false);
                          setShowCustomClipCount(false);
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        Use Recommended Settings
                      </Button>
                    )}
                  </div>
                )}

                {/* Case 5/6: Info - short/long video */}
                {clipValidation.status === "info" && (
                  <div className="p-4 rounded-xl bg-info/10 border border-info/20 space-y-3">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-info">{clipValidation.issues?.[0] || "Note"}</p>
                        <p className="text-xs text-text-secondary mt-1">
                          {clipValidation.issues?.slice(1).map((issue, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <span className="text-info">•</span>
                              <span>{issue}</span>
                            </div>
                          ))}
                        </p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-overlay">
                      <p className="text-xs text-text-secondary">
                        <strong>Source video:</strong> {formatDuration(clipValidation.videoLength)}<br/>
                        <strong>Recommended:</strong> {clipValidation.recommendations?.[0]?.clipDuration}s clips × {clipValidation.recommendations?.[0]?.clipCount} clips
                      </p>
                    </div>
                    {clipValidation.recommendations && clipValidation.recommendations.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const rec = clipValidation.recommendations[0];
                          if (rec.clipDuration) setClipDuration(rec.clipDuration);
                          if (rec.clipCount) setClipCount(rec.clipCount);
                          setShowCustomClipDuration(false);
                          setShowCustomClipCount(false);
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        Apply Recommended Settings
                      </Button>
                    )}
                  </div>
                )}

                {/* Ideal - Green check */}
                {clipValidation.status === "ideal" && (
                  <div className="p-3 rounded-xl bg-success/10 border border-success/20 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-success">Ideal Configuration</p>
                      <p className="text-xs text-success/80">
                        Your clip duration and count are well-matched for this video length.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2.5 flex items-center gap-1.5">
                Number of Clips
                <Info className="w-3.5 h-3.5 text-text-muted" />
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
                {CLIP_COUNT_OPTIONS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => { setClipCount(count); setShowCustomClipCount(false); }}
                    className={cn(
                      "h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 border-2 transition-all duration-150",
                      clipCount === count && !showCustomClipCount
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface hover:border-border text-text-secondary hover:text-text"
                    )}
                  >
                    <span className="text-lg font-bold tabular-nums">{count}</span>
                    <span className="text-[10px] font-medium">clips</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowCustomClipCount(true)}
                  className={cn(
                    "h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 border-2 border-dashed transition-all duration-150",
                    showCustomClipCount
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-surface hover:border-border text-text-secondary hover:text-text"
                  )}
                >
                  <span className="text-lg font-bold">Custom</span>
                  <span className="text-[10px] font-medium">clips</span>
                </button>
              </div>
              {showCustomClipCount && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={customClipCount}
                    onChange={(e) => setCustomClipCount(e.target.value)}
                    onBlur={() => {
                      const val = parseInt(customClipCount, 10) || 5;
                      const clamped = Math.max(1, Math.min(50, val));
                      setClipCount(clamped);
                      setCustomClipCount("");
                      setShowCustomClipCount(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = parseInt(customClipCount, 10) || 5;
                        const clamped = Math.max(1, Math.min(50, val));
                        setClipCount(clamped);
                        setCustomClipCount("");
                        setShowCustomClipCount(false);
                      }
                    }}
                    placeholder="1-50"
                    className="w-24"
                  />
                  <span className="text-xs text-text-muted">clips</span>
                </div>
              )}
            </div>

            {/* Clip Duration */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2.5 flex items-center gap-1.5">
                Clip Duration
                <Info className="w-3.5 h-3.5 text-text-muted" />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2">
                {CLIP_DURATION_OPTIONS.map((cl) => (
                  <button
                    key={cl.label}
                    type="button"
                    onClick={() => { setClipDuration(cl.value); setShowCustomClipDuration(false); }}
                    className={cn(
                      "p-3.5 rounded-xl border-2 text-left transition-all duration-150",
                      clipDuration === cl.value && !showCustomClipDuration
                        ? "border-primary bg-primary/5"
                        : "border-border bg-surface hover:border-border"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-text flex items-center gap-1.5">
                        {cl.label}
                        {cl.pro && <span className="text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1.5 py-0.5 rounded-full">Pro</span>}
                      </span>
                      <Badge variant={clipDuration === cl.value && !showCustomClipDuration ? "primary" : "default"} size="sm">
                        {cl.value != null
                          ? `${calculateCredits({ clipCount: 1, clipDuration: cl.value }, pricing)} cr`
                          : "AI decides"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">{cl.desc}</p>
                  </button>
                ))}
                {!isAiOptimized && (
                  <button
                    type="button"
                    onClick={() => setShowCustomClipDuration(true)}
                    className={cn(
                      "p-3.5 rounded-xl border-2 border-dashed text-left transition-all duration-150 flex flex-col items-center justify-center gap-1.5",
                      showCustomClipDuration
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-surface hover:border-border text-text-secondary hover:text-text"
                    )}
                  >
                    <span className="text-sm font-medium">Custom Duration</span>
                    <span className="text-[10px] font-medium">10-180s</span>
                  </button>
                )}
              </div>
              {showCustomClipDuration && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="10"
                    max="180"
                    value={customClipDuration}
                    onChange={(e) => setCustomClipDuration(e.target.value)}
                    onBlur={() => {
                      const val = parseInt(customClipDuration, 10) || 30;
                      const clamped = Math.max(10, Math.min(180, val));
                      setClipDuration(clamped);
                      setCustomClipDuration("");
                      setShowCustomClipDuration(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = parseInt(customClipDuration, 10) || 30;
                        const clamped = Math.max(10, Math.min(180, val));
                        setClipDuration(clamped);
                        setCustomClipDuration("");
                        setShowCustomClipDuration(false);
                      }
                    }}
                    placeholder="10-180"
                    className="w-28"
                  />
                  <span className="text-xs text-text-muted">seconds</span>
                </div>
              )}
            </div>

            {/* Platform */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2.5">Platform</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {platforms.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPlatform(p.value)}
                    className={cn(
                      "h-14 rounded-xl flex items-center justify-center gap-2 border-2 transition-all duration-150",
                      platform === p.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface hover:border-border text-text-secondary hover:text-text"
                    )}
                  >
                    <span className="text-lg">{p.icon}</span>
                    <span className="text-sm font-medium">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2.5">Caption Style</label>
              <div className="grid grid-cols-2 gap-2.5">
                {captionStyles.map((cs) => {
                  const isLocked = cs.pro && !isProOrAbove;
                  return (
                    <button
                      key={cs.value}
                      type="button"
                      onClick={() => handleCaptionStyleSelect(cs.value)}
                      className={cn(
                        "p-3 rounded-xl border-2 text-left transition-all duration-150 relative",
                        captionPreset === cs.value && captionStyle === "popup"
                          ? "border-primary bg-primary/5"
                          : isLocked
                            ? "border-border bg-surface opacity-75 hover:border-accent/30 hover:opacity-90"
                            : "border-border bg-surface hover:border-border"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-text">{cs.label}</span>
                          {cs.pro && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-accent/15 text-accent">
                              <Crown className="w-2.5 h-2.5" /> PRO
                            </span>
                          )}
                        </div>
                        {isLocked ? (
                          <Lock className="w-3.5 h-3.5 text-text-muted" />
                        ) : (
                          captionPreset === cs.value && captionStyle === "popup" && <Check className="w-3.5 h-3.5 text-primary" />
                        )}
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed">{cs.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CAPTION CUSTOMIZATION — shown when a preset is selected */}
            {captionStyle === "popup" && isProOrAbove && (
              <div className="animate-slide-down space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="rounded-xl bg-surface/80 backdrop-blur-glass border border-border/30 p-5 shadow-card hover:shadow-card-hover transition-all duration-300">
                    <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">Caption Position</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Upper", pct: 75 },
                        { label: "Center", pct: 50 },
                        { label: "Center Low", pct: 35 },
                        { label: "Lower", pct: 20 },
                      ].map((opt, idx) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setCaptionConfig(prev => ({ ...prev, verticalPct: opt.pct }))}
                          className={cn(
                            "relative py-3 px-2 rounded-lg text-xs font-medium transition-all duration-200",
                            Math.abs(captionConfig.verticalPct - opt.pct) < 5
                              ? "bg-primary/20 text-primary border border-primary/40"
                              : "bg-surface-subtle text-text-secondary border border-border hover:bg-surface-overlay hover:border-border-strong"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <Slider
                      value={captionConfig.verticalPct}
                      onChange={(v) => setCaptionConfig(prev => ({ ...prev, verticalPct: v }))}
                      min={10}
                      max={90}
                      step={1}
                      label="Custom Y Position"
                      unit="%"
                      className="mt-5"
                    />
                  </div>

                  <div className="rounded-xl bg-surface/80 backdrop-blur-glass border border-border/30 p-5 shadow-card hover:shadow-card-hover transition-all duration-300">
                    <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">Animation Speed</h4>
                    <div className="space-y-4">
                      <Slider
                        value={captionConfig.animIn}
                        onChange={(v) => setCaptionConfig(prev => ({ ...prev, animIn: v }))}
                        min={20}
                        max={400}
                        step={10}
                        label="Pop-In Speed"
                        unit="ms"
                      />
                      <Slider
                        value={captionConfig.animOut}
                        onChange={(v) => setCaptionConfig(prev => ({ ...prev, animOut: v }))}
                        min={20}
                        max={400}
                        step={10}
                        label="Pop-Out Speed"
                        unit="ms"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 backdrop-blur-glass p-6 shadow-card glass-card-hover transition-all duration-300">
                  <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">Pro Features Preview</h4>
                  <div className="text-xs text-text-secondary space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" /> <span>Custom positioning for 9:16 vertical videos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" /> <span>Precise timing for word-by-word pop-ups</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" /> <span>Smooth animations synchronized to speech</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2.5">Captions</label>
              <button
                type="button"
                onClick={() => setCaptionsEnabled(!captionsEnabled)}
                className={cn(
                  "w-full p-3 rounded-xl border-2 text-left transition-all duration-150 flex items-center gap-3",
                  captionsEnabled
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:border-border"
                )}
              >
                <div className={cn(
                  "w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 relative",
                  captionsEnabled ? "bg-primary" : "bg-surface-overlay"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                    captionsEnabled ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-text">{captionsEnabled ? "Captions On" : "Captions Off"}</span>
                  <p className="text-[11px] text-text-secondary leading-relaxed">{captionsEnabled ? "Styled captions will be burned into your clips" : "No captions on generated clips"}</p>
                </div>
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2.5">Video Enhancements</label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setStabilization(!stabilization)}
                  className={cn(
                    "w-full p-3 rounded-xl border-2 text-left transition-all duration-150 flex items-center gap-3",
                    stabilization
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface hover:border-border"
                  )}
                >
                  <div className={cn(
                    "w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 relative",
                    stabilization ? "bg-primary" : "bg-surface-overlay"
                  )}>
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                      stabilization ? "translate-x-4" : "translate-x-0.5"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text">Stabilize Video</span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">Removes camera shake and jitter automatically</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFaceTracking(!faceTracking)}
                  className={cn(
                    "w-full p-3 rounded-xl border-2 text-left transition-all duration-150 flex items-center gap-3",
                    faceTracking
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface hover:border-border"
                  )}
                >
                  <div className={cn(
                    "w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 relative",
                    faceTracking ? "bg-primary" : "bg-surface-overlay"
                  )}>
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                      faceTracking ? "translate-x-4" : "translate-x-0.5"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text">AI Face Tracking</span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">Keeps the main subject centered in frame</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAutoReframe(!autoReframe)}
                  className={cn(
                    "w-full p-3 rounded-xl border-2 text-left transition-all duration-150 flex items-center gap-3",
                    autoReframe
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface hover:border-border"
                  )}
                >
                  <div className={cn(
                    "w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 relative",
                    autoReframe ? "bg-primary" : "bg-surface-overlay"
                  )}>
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                      autoReframe ? "translate-x-4" : "translate-x-0.5"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text">Auto Reframe for Shorts</span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">Smart face-aware crop from landscape to vertical (9:16)</p>
                  </div>
                </button>

                {/* AI CLOSE-UP FRAMING TOGGLE */}
                <div className="h-px bg-border my-1" />
                <button
                  type="button"
                  onClick={() => {
                    if (!["pro", "business"].includes(creditsData?.plan)) {
                      setShowPremiumModal(true);
                      return;
                    }
                    setCloseUpFraming(!closeUpFraming);
                  }}
                  className={cn(
                    "w-full p-3 rounded-xl border-2 text-left transition-all duration-150 flex items-center gap-3",
                    closeUpFraming
                      ? "border-accent bg-accent/5"
                      : "border-border bg-surface hover:border-border"
                  )}
                >
                  <div className={cn(
                    "w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 relative",
                    closeUpFraming ? "bg-accent" : "bg-surface-overlay"
                  )}>
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                      closeUpFraming ? "translate-x-4" : "translate-x-0.5"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text">AI Close-Up Framing</span>
                      {!(["pro", "business"].includes(creditsData?.plan)) && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-accent/15 text-accent">
                          <Crown className="w-2.5 h-2.5" /> PRO
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">Automatically crop and follow the active speaker with smooth camera motion</p>
                  </div>
                </button>

                {/* CLOSE-UP FRAMING MODE */}
                {closeUpFraming && (
                  <div className="ml-6 mt-2 space-y-2 animate-slide-down">
                    <label className="block text-[11px] font-medium text-text-secondary">Framing Mode</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {closeUpModes.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setCloseUpMode(m.value)}
                          className={cn(
                            "p-2 rounded-lg border text-center transition-all duration-150",
                            closeUpMode === m.value
                              ? "border-accent bg-accent/5"
                              : "border-border bg-surface-subtle hover:border-border"
                          )}
                        >
                          <span className="text-[11px] font-medium text-text">{m.label}</span>
                          <p className="text-[9px] text-text-muted mt-0.5 leading-tight">{m.desc}</p>
                        </button>
                      ))}
                    </div>

                    {/* AUTO PUNCH-IN TOGGLE */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!["pro", "business"].includes(creditsData?.plan)) {
                          setShowPremiumModal(true);
                          return;
                        }
                        setAutoPunchIn(!autoPunchIn);
                      }}
                      className={cn(
                        "w-full p-2.5 rounded-lg border text-left transition-all duration-150 flex items-center gap-2.5",
                        autoPunchIn
                          ? "border-accent/50 bg-accent/5"
                          : "border-border bg-surface-subtle hover:border-border"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-[18px] rounded-full transition-colors duration-200 flex-shrink-0 relative",
                        autoPunchIn ? "bg-accent" : "bg-surface-overlay"
                      )}>
                        <div className={cn(
                          "absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200",
                          autoPunchIn ? "translate-x-[14px]" : "translate-x-[2px]"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-medium text-text">Auto Punch-In</span>
                        <p className="text-[9px] text-text-muted">Subtle zooms during emphasis moments</p>
                      </div>
                    </button>

                    {/* AUTO SPEAKER SWITCH TOGGLE */}
                    <button
                      type="button"
                      onClick={() => setAutoSpeakerSwitch(!autoSpeakerSwitch)}
                      className={cn(
                        "w-full p-2.5 rounded-lg border text-left transition-all duration-150 flex items-center gap-2.5",
                        autoSpeakerSwitch
                          ? "border-accent/50 bg-accent/5"
                          : "border-border bg-surface-subtle hover:border-border"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-[18px] rounded-full transition-colors duration-200 flex-shrink-0 relative",
                        autoSpeakerSwitch ? "bg-accent" : "bg-surface-overlay"
                      )}>
                        <div className={cn(
                          "absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200",
                          autoSpeakerSwitch ? "translate-x-[14px]" : "translate-x-[2px]"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-medium text-text">Auto Speaker Switching</span>
                        <p className="text-[9px] text-text-muted">Smooth pan between speakers</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={goBack} className="flex-1 h-11">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={goNext} className="flex-1 h-11">
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-5">
            <Card className="p-4 bg-surface-subtle">
              <h4 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-highlight" />
                Estimated Cost & Processing
              </h4>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 rounded-lg bg-bg">
                  <p className="text-xl sm:text-2xl font-bold text-text tabular-nums">{effectiveClipCount}</p>
                  <p className="text-[11px] text-text-secondary mt-0.5">Clips</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-bg">
                  <p className="text-xl sm:text-2xl font-bold text-text tabular-nums">{isAiOptimized ? "AI" : `${effectiveDuration}s`}</p>
                  <p className="text-[11px] text-text-secondary mt-0.5">{isAiOptimized ? "AI Picks" : "Per Clip"}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-bg">
                  <p className="text-xl sm:text-2xl font-bold text-highlight tabular-nums">{calculateCredits({ clipCount: effectiveClipCount, clipDuration: effectiveDuration }, pricing)}</p>
                  <p className="text-[11px] text-text-secondary mt-0.5">Credits</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-surface-overlay">
                <div className="text-center">
                  <p className="text-lg font-bold text-primary tabular-nums">
                    {isAiOptimized ? "Varies" : `${Math.ceil(effectiveClipCount * effectiveDuration / 180)} min`}
                  </p>
                  <p className="text-[11px] text-text-secondary mt-0.5">Est. Processing</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-accent tabular-nums">
                    {isAiOptimized ? "Varies" : `${formatNumber(Math.ceil(effectiveClipCount * effectiveDuration / 60))}s`}
                  </p>
                  <p className="text-[11px] text-text-secondary mt-0.5">Total Clip Time</p>
                </div>
              </div>
            </Card>

            {/* Smart Warnings */}
            {(isHighWorkload || isVeryHighWorkload) && (
              <Card className="p-3.5 border-warning/30 bg-warning/5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-warning">High Workload Configuration</p>
                    <p className="text-xs text-text-secondary mt-1">
                      {isVeryHighWorkload
                        ? "This configuration (20+ clips × 120s) is very intensive. Processing may take 10+ minutes and will consume significant credits. Quality may vary for longer clips."
                        : "This configuration may take longer to process and will consume more credits. Consider fewer clips or shorter duration for faster results."}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <div className={cn(
              "p-3.5 rounded-xl flex items-start gap-3",
              canAfford ? "bg-success/10 border border-success/20" : "bg-danger/10 border border-danger/20"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                canAfford ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
              )}>
                {canAfford ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">{canAfford ? "Sufficient credits" : "Insufficient credits"}</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {canAfford
                    ? `You have ${formatCredits(userCredits)}. ${estimatedCredits} credits will be reserved.`
                    : `You need ${estimatedCredits - userCredits} more credits.`}
                </p>
              </div>
              {!canAfford && (
                <Button variant="ghost" size="sm" className="h-7 text-xs flex-shrink-0 ml-auto" asChild>
                  <Link to="/billing">Buy Credits</Link>
                </Button>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" onClick={goBack} className="flex-1 h-11" disabled={isProcessing}>
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!canAfford || isProcessing || clipValidation?.status === "impossible"}
                className="flex-1 h-11"
                loading={isProcessing}
              >
                {isProcessing ? (generateStep || "Starting...") : "Generate Clips"}
                {!isProcessing && <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
          <div className="text-center space-y-5 max-w-sm mx-auto px-6">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse-ring" />
              <div className="absolute inset-3 rounded-full bg-primary/5 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
              <div className="relative w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-semibold text-text">{generateStep || "Preparing..."}</p>
              <p className="text-xs text-text-secondary">This may take a few moments. Don't close this page.</p>
            </div>
          </div>
        </div>
      )}

      {/* Step dots (mobile) */}
      <div className="flex justify-center gap-1.5 sm:hidden">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => i <= step && setStep(i)}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-200",
              i === step ? "bg-primary w-5" : i < step ? "bg-primary/50" : "bg-surface-overlay"
            )}
            disabled={i > step}
            aria-label={`Go to step ${i + 1}`}
          />
        ))}
      </div>

      {/* Premium Upgrade Modal */}
      <Modal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} title="Pro Feature" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20">
            <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Pop-Up Captions</p>
              <p className="text-xs text-text-secondary mt-0.5">Animated word-by-word viral-style captions</p>
            </div>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Pop-Up Captions create modern viral-style subtitles with word-by-word highlighting, dynamic scaling,
            and emphasis effects — the style you see on TikTok, Reels, and YouTube Shorts.
          </p>
          <div className="space-y-1.5">
            {[
              "Word-by-word pop-in animations",
              "AI-detected emphasis on important words",
              "Dynamic scaling for hooks and punchlines",
              "Mobile-optimized rendering",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-xs text-text-secondary">
                <Check className="w-3.5 h-3.5 text-success flex-shrink-0" />
                {feat}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1 h-10" onClick={() => setShowPremiumModal(false)}>
              Maybe Later
            </Button>
            <Button className="flex-1 h-10" onClick={() => { setShowPremiumModal(false); navigate("/billing"); }}>
              <Crown className="w-4 h-4" /> Upgrade to Pro
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function estimateProcessingTime(durationSeconds) {
  if (!durationSeconds) return "a few minutes";
  const minutes = Math.ceil(durationSeconds / 60 * 0.3);
  if (minutes < 2) return "under 1 minute";
  if (minutes < 5) return `~${minutes} minutes`;
  return `~${minutes} minutes`;
}
