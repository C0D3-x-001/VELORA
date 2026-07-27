import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle, AlertCircle, ArrowRight, RotateCcw, Download, Music,
  Brain, Scissors, Clock, Zap, Film, Wand2, CloudUpload,
  Trophy, Star, Lightbulb, TrendingUp, Target, MessageSquare, BarChart3, Sparkles
} from "lucide-react";
import { useProject, useProjectStatus, useGenerateClips } from "../../hooks/queries";
import Card from "../../components/ui/Card/Card";
import Badge from "../../components/ui/Badge/Badge";
import Button from "../../components/ui/Button/Button";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import Spinner from "../../components/ui/Spinner/Spinner";
import { SkeletonProcessing } from "../../components/ui/Skeleton/Skeleton";
import { cn, getErrorMessage } from "../../lib/utils";

const PIPELINE_STEPS = [
  { id: "downloading", label: "Downloading Video", desc: "Fetching your video from the source", icon: Download, color: "text-blue-400", bg: "bg-blue-500/15", ring: "ring-blue-500/30" },
  { id: "extracting", label: "Extracting Audio", desc: "Preparing audio for transcription", icon: Music, color: "text-cyan-400", bg: "bg-cyan-500/15", ring: "ring-cyan-500/30" },
  { id: "transcribing", label: "Generating Transcript", desc: "AI is transcribing speech to text", icon: MessageSquare, color: "text-primary", bg: "bg-primary/15", ring: "ring-primary/30" },
  { id: "analyzing", label: "Finding Viral Moments", desc: "AI is scoring engagement potential", icon: Brain, color: "text-accent", bg: "bg-accent/15", ring: "ring-accent/30" },
  { id: "processing", label: "Rendering Clips", desc: "Cutting and encoding your clips", icon: Scissors, color: "text-highlight", bg: "bg-highlight/15", ring: "ring-highlight/30" },
  { id: "enhancing", label: "Enhancing Video", desc: "Applying stabilization, close-up framing, face tracking, and auto-reframing", icon: Sparkles, color: "text-cyan-400", bg: "bg-cyan-500/15", ring: "ring-cyan-500/30" },
  { id: "uploading", label: "Uploading Results", desc: "Saving clips to cloud storage", icon: CloudUpload, color: "text-purple-400", bg: "bg-purple-500/15", ring: "ring-purple-500/30" },
  { id: "completed", label: "All Done", desc: "Your clips are ready!", icon: Trophy, color: "text-success", bg: "bg-success/15", ring: "ring-success/30" },
];

const STATUS_TO_STEP = {
  created: 0,
  downloading: 0,
  extracting: 1,
  transcribing: 2,
  analyzing: 3,
  processing: 4,
  enhancing: 5,
  uploading: 6,
  completed: 7,
};

const tips = [
  { icon: Lightbulb, text: "Velora analyzes hooks, emotional peaks, and story arcs to find viral moments" },
  { icon: TrendingUp, text: "Longer videos often produce better clips — the AI has more material to work with" },
  { icon: Target, text: "Each clip gets a viral score based on engagement prediction models" },
  { icon: Wand2, text: "You can regenerate any clip with different settings after processing" },
  { icon: MessageSquare, text: "Auto-captions boost retention by up to 40% on average" },
  { icon: Star, text: "Short-form clips under 60s perform best on TikTok and Reels" },
  { icon: BarChart3, text: "Clips with strong openers in the first 3 seconds get 2x more views" },
  { icon: Film, text: "The AI looks for natural conversation breaks for clean clip boundaries" },
];

function getStepIndex(status) {
  return STATUS_TO_STEP[status] ?? 0;
}

function getProgress(status) {
  const idx = getStepIndex(status);
  return Math.round((idx / (PIPELINE_STEPS.length - 1)) * 100);
}

function getEstimatedRemaining(durationSeconds, currentStepIdx) {
  if (!durationSeconds || currentStepIdx >= 6) return null;
  const totalMinutes = Math.max(1, Math.min(12, Math.round(durationSeconds / 120)));
  const remaining = Math.max(1, Math.round(totalMinutes * (1 - currentStepIdx / 6)));
  return remaining;
}

function getElapsedSeconds(createdAt) {
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
}

function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function TimelineStep({ step, state, isLast }) {
  const { isDone, isActive, isError } = state;

  return (
    <div className="flex gap-4 relative">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[19px] top-[40px] w-[2px] h-[calc(100%-16px)]">
          <div className={cn(
            "w-full h-full rounded-full transition-colors duration-500",
            isDone ? "bg-success/40" : "bg-surface-overlay"
          )} />
          {isActive && (
            <div className="absolute top-0 left-0 w-full h-8 rounded-full bg-primary/30 animate-pulse" />
          )}
        </div>
      )}

      {/* Icon */}
      <div className="relative z-10 flex-shrink-0">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
          isDone && !isError && "bg-success/15 text-success ring-1 ring-success/20",
          isActive && cn(step.bg, step.color, "ring-2", step.ring),
          isError && "bg-danger/15 text-danger ring-1 ring-danger/20",
          !isDone && !isActive && !isError && "bg-surface-subtle text-text-muted"
        )}>
          {isDone && !isError ? (
            <CheckCircle className="w-5 h-5" />
          ) : isActive ? (
            <Spinner size="sm" className={step.color} />
          ) : isError ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <step.icon className="w-4.5 h-4.5" />
          )}
        </div>
        {isActive && (
          <div className={cn("absolute -inset-1.5 rounded-xl animate-pulse opacity-40", step.bg)} />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0 pb-6", isLast && "pb-0")}>
        <div className="flex items-center gap-2">
          <p className={cn(
            "text-sm font-medium transition-colors",
            isActive ? "text-text" : isDone && !isError ? "text-success" : isError ? "text-danger" : "text-text-muted"
          )}>
            {step.label}
          </p>
          {isActive && (
            <div className="flex gap-1 ml-1">
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0s" }} />
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.16s" }} />
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.32s" }} />
            </div>
          )}
        </div>
        <p className={cn(
          "text-xs mt-0.5 transition-colors",
          isActive ? "text-text-secondary" : "text-text-muted"
        )}>
          {step.desc}
        </p>
      </div>
    </div>
  );
}

export default function ProcessingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: projectData, isLoading } = useProject(id);
  const retryMutation = useGenerateClips();
  const [tipIndex, setTipIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const { data: statusData } = useProjectStatus(id, {
    refetchInterval: (query) => {
      const s = query.state?.data?.status;
      if (s === "completed" || s === "failed") return false;
      return 5000;
    },
  });

  const project = statusData ? { ...projectData, ...Object.fromEntries(Object.entries(statusData).filter(([, v]) => v !== undefined)) } : projectData;

  const isProcessing = project?.status && project.status !== "completed" && project.status !== "failed";

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (project?.status && project.status !== "completed" && project.status !== "failed") {
        setElapsed(getElapsedSeconds(project.created_at));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [project?.status, project?.created_at]);

  useEffect(() => {
    if (project?.status === "completed") {
      const timeout = setTimeout(() => navigate(`/dashboard/projects/${id}/results`), 2000);
      return () => clearTimeout(timeout);
    }
  }, [project?.status, id, navigate]);

  if (isLoading) return <SkeletonProcessing />;

  if (!project) {
    return (
      <EmptyState
        variant="danger"
        icon={<AlertCircle className="w-7 h-7" />}
        title="Project not found"
        description="This project may have been deleted or you don't have access to it."
        action={{ onClick: () => navigate("/dashboard"), children: "Back to Dashboard" }}
        secondaryAction={{ onClick: () => navigate("/dashboard/create"), children: "Create New Project" }}
      />
    );
  }

  const currentStepIdx = getStepIndex(project.status);
  const progress = getProgress(project.status);
  const isComplete = project.status === "completed";
  const isFailed = project.status === "failed";
  const isStuck = (project.status === "processing" || project.status === "analyzing") &&
    project.updated_at && (Date.now() - new Date(project.updated_at).getTime()) > 10 * 60 * 1000;
  const estimatedMin = isProcessing ? getEstimatedRemaining(project.duration_seconds, currentStepIdx) : null;
  const currentTip = tips[tipIndex];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text truncate">{project.title}</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {isComplete ? "All clips ready!" : isFailed ? "Processing failed" : PIPELINE_STEPS[currentStepIdx]?.desc}
          </p>
        </div>
        <Badge variant={isComplete ? "success" : isFailed ? "danger" : "primary"} size="md">
          {isComplete ? "Complete" : isFailed ? "Failed" : "Processing"}
        </Badge>
      </div>

      {/* Progress Bar + Stats */}
      <Card className="glass-card p-4 sm:p-5">
        <div className="space-y-3">
          {/* Bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-surface-overlay rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden",
                  isComplete ? "bg-gradient-to-r from-green-500 to-success" : isFailed ? "bg-danger" : "bg-gradient-to-r from-primary to-accent"
                )}
                style={{ width: `${isComplete ? 100 : progress}%` }}
              >
                {isProcessing && (
                  <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                )}
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-text tabular-nums w-9 text-right">{progress}%</span>
          </div>

          {/* Time info */}
          {isProcessing && (
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatElapsed(elapsed)}
                </span>
                {estimatedMin && (
                  <span className="inline-flex items-center gap-1">
                    <Zap className="w-3 h-3 text-primary" />
                    ~{estimatedMin} min left
                  </span>
                )}
              </div>
              {project.duration_seconds > 0 && (
                <span>{Math.round(project.duration_seconds / 60)}m source video</span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Timeline */}
      <Card className="glass-card p-4 sm:p-5">
        <div className="space-y-0">
          {PIPELINE_STEPS.map((step, i) => {
            const isDone = i < currentStepIdx || (isComplete && i <= currentStepIdx);
            const isActive = i === currentStepIdx && !isComplete && !isFailed;
            const isError = isFailed && i === currentStepIdx;
            return (
              <TimelineStep
                key={step.id}
                step={step}
                index={i}
                state={{ isDone, isActive, isError }}
                isLast={i === PIPELINE_STEPS.length - 1}
              />
            );
          })}
        </div>

        {/* Tip */}
        {isProcessing && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-subtle/50">
              <div className="w-8 h-8 rounded-lg bg-highlight/10 flex items-center justify-center flex-shrink-0">
                <currentTip.icon className="w-4 h-4 text-highlight" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-0.5">Creator Tip</p>
                <p className="text-xs text-text-secondary leading-relaxed" key={tipIndex}>{currentTip.text}</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Failed */}
      {isFailed && (
        <Card className="glass-card p-5 border-danger/20 animate-slide-down">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-danger/15 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-danger" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-danger">Processing failed</p>
              <p className="text-[11px] text-danger/70 mt-1.5">An error occurred during processing.</p>
              <p className="text-xs text-text-secondary mt-2">No credits were charged. You can safely retry.</p>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9"
                  loading={retryMutation.isPending}
                  disabled={retryMutation.isPending}
                  onClick={() => retryMutation.mutate({ projectId: id, settings: project?.settings || {} })}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {retryMutation.isPending ? "Retrying..." : "Retry"}
                </Button>
                <Button variant="ghost" size="sm" className="h-9" onClick={() => navigate("/dashboard/create")}>
                  Upload New
                </Button>
              </div>
              {retryMutation.isError && (
                <p className="text-danger text-xs mt-2">{getErrorMessage(retryMutation.error, "Retry failed.")}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Stuck warning */}
      {isStuck && !isFailed && !isComplete && (
        <Card className="glass-card p-5 border-warning/20 animate-slide-down">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning/15 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-warning">Processing appears stuck</p>
              <p className="text-xs text-text-secondary mt-1.5">This project has been processing for over 10 minutes. Credits will be refunded for any failed attempts.</p>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9"
                  loading={retryMutation.isPending}
                  disabled={retryMutation.isPending}
                  onClick={() => retryMutation.mutate({ projectId: id, settings: project?.settings || {} })}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Processing
                </Button>
                <Button variant="ghost" size="sm" className="h-9" onClick={() => navigate("/dashboard/create")}>
                  Upload New
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Complete */}
      {isComplete && (
        <Card className="glass-card p-6 sm:p-8 text-center animate-scale-in border-success/20">
          <div className="w-14 h-14 rounded-2xl bg-success/15 border border-success/20 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-7 h-7 text-success" />
          </div>
          <h3 className="text-lg font-bold text-text mb-1">Your clips are ready!</h3>
          <p className="text-sm text-text-secondary mb-5">
            {project.clips_count || 0} clips generated
            {project.avg_viral_score ? ` with an avg viral score of ${project.avg_viral_score}` : ""}
          </p>
          <Button size="lg" onClick={() => navigate(`/dashboard/projects/${id}/results`)}>
            View Results <ArrowRight className="w-4 h-4" />
          </Button>
        </Card>
      )}
    </div>
  );
}
