import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Download, Undo2, Redo2, Settings2, Play, Pause } from "lucide-react";
import { useClipEditState, useSaveClipEditState, useProject, useUpdateCaptionStyle, useRegenerateClip } from "../../hooks/queries";
import { useToast } from "../../components/ui/Toast/Toast";
import Button from "../../components/ui/Button/Button";
import Spinner from "../../components/ui/Spinner/Spinner";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import EditorVideoPreview from "../../components/editor/EditorVideoPreview";
import CanvasTimeline from "../../components/editor/CanvasTimeline";
import EditorLeftSidebar from "../../components/editor/EditorLeftSidebar";
import EditorRightSidebar from "../../components/editor/EditorRightSidebar";
import { cn, formatDuration } from "../../lib/utils";
import { getCaptionPresetStyle } from "../../lib/captionPresets";

let segIdCounter = 0;
function nextSegId() { return "seg_" + (++segIdCounter) + "_" + Date.now(); }

function initClipSegments(existingTrim, duration) {
  return [{ id: nextSegId(), start: existingTrim?.start || 0, end: existingTrim?.end || duration }];
}

function outputDuration(segments) {
  return segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
}

function outputToSource(segments, outputTime) {
  let elapsed = 0;
  for (const seg of segments) {
    const d = seg.end - seg.start;
    if (outputTime <= elapsed + d) return seg.start + (outputTime - elapsed);
    elapsed += d;
  }
  return segments.length > 0 ? segments[segments.length - 1].end : 0;
}

function sourceToOutput(segments, sourceTime) {
  let elapsed = 0;
  for (const seg of segments) {
    if (sourceTime < seg.end) return elapsed + Math.max(0, sourceTime - seg.start);
    elapsed += seg.end - seg.start;
  }
  return elapsed;
}

function useEditHistory(initialState) {
  const [history, setHistory] = useState([]);
  const [index, setIndex] = useState(-1);
  const initializedRef = useRef(false);
  const indexRef = useRef(-1);

  useEffect(() => {
    if (initialState && !initializedRef.current) {
      initializedRef.current = true;
      setHistory([initialState]);
      setIndex(0);
      indexRef.current = 0;
    }
  }, [initialState]);

  const push = useCallback((newState) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, indexRef.current + 1);
      return [...trimmed, newState];
    });
    indexRef.current += 1;
    setIndex(indexRef.current);
  }, []);

  const undo = useCallback(() => {
    const next = Math.max(0, indexRef.current - 1);
    indexRef.current = next;
    setIndex(next);
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      const next = Math.min(prev.length - 1, indexRef.current + 1);
      indexRef.current = next;
      setIndex(next);
      return prev;
    });
  }, []);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;
  const current = history[index] || initialState || {};

  return { current, push, undo, redo, canUndo, canRedo };
}

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

export default function ClipEditorPage() {
  const { id: projectId, clipId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: project } = useProject(projectId);
  const saveMutation = useSaveClipEditState(projectId, clipId);
  const updateCaption = useUpdateCaptionStyle();
  const regenerate = useRegenerateClip();
  const autosaveTimerRef = useRef(null);

  const { data, isLoading, error } = useClipEditState(projectId, clipId);
  const clip = data?.clip;
  const transcript = data?.transcript;
  const initialEditState = data?.editState || {};

  const initialStateRef = useRef(null);
  if (initialEditState && clip && !initialStateRef.current) {
    const duration = clip.duration_seconds || 0;
    const segments = initialEditState.clipSegments || initClipSegments(initialEditState.trim, duration);
    const presetName = initialEditState.captionPreset || clip?.caption_preset || "classic";
    const presetDefaults = getCaptionPresetStyle(presetName);
    initialStateRef.current = {
      clipSegments: segments,
      captions: initialEditState.captions || { segments: [], overrides: [] },
      captionConfig: { ...presetDefaults, ...(initialEditState.captionConfig || {}) },
      captionPreset: presetName,
      captionStyle: initialEditState.captionStyle || clip?.caption_style || "classic",
      exportSettings: initialEditState.exportSettings || { resolution: "1080x1920", fps: 30, bitrate: "high" },
    };
  }

  const { current: historyState, push: pushHistory, undo, redo, canUndo, canRedo } = useEditHistory(initialStateRef.current);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeCaptionIndex, setActiveCaptionIndex] = useState(-1);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const videoRef = useRef(null);
  const playingRef = useRef(false);
  const seekingRef = useRef(false);

  const stateToSave = useMemo(() => historyState || {}, [historyState]);

  const scheduleAutosave = useCallback((state) => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      saveMutation.mutate(state, {
        onError: () => toast({ title: "Autosave failed", type: "error" }),
      });
    }, 2000);
  }, [saveMutation, toast]);

  const stateRef = useRef(historyState);
  stateRef.current = historyState;

  const updateEditState = useCallback((patch) => {
    const current = stateRef.current || {};
    const next = { ...current, ...patch };
    pushHistory(next);
    scheduleAutosave(next);
  }, [pushHistory, scheduleAutosave]);

  const clipSegments = historyState?.clipSegments || initClipSegments(null, clip?.duration_seconds || 0);
  const totalDuration = useMemo(() => outputDuration(clipSegments), [clipSegments]);

  const splitSegment = useCallback((atOutputTime) => {
    const segs = stateRef.current?.clipSegments;
    if (!segs || segs.length === 0) return;
    let elapsed = 0;
    for (const seg of segs) {
      const d = seg.end - seg.start;
      if (atOutputTime <= elapsed + d && d > 0.5) {
        const splitSourceTime = seg.start + (atOutputTime - elapsed);
        const newSegs = [];
        for (const s of segs) {
          if (s.id === seg.id) {
            newSegs.push({ id: s.id, start: s.start, end: splitSourceTime });
            newSegs.push({ id: nextSegId(), start: splitSourceTime, end: s.end });
          } else {
            newSegs.push({ ...s });
          }
        }
        updateEditState({ clipSegments: newSegs });
        return;
      }
      elapsed += d;
    }
  }, [updateEditState]);

  const deleteSegment = useCallback((segmentId) => {
    const segs = stateRef.current?.clipSegments;
    if (!segs || segs.length <= 1) return;
    const newSegs = segs.filter((s) => s.id !== segmentId);
    if (newSegs.length > 0) {
      updateEditState({ clipSegments: newSegs });
      setSelectedSegmentId(null);
    }
  }, [updateEditState]);

  const trimSegment = useCallback((segmentId, newStart, newEnd) => {
    const segs = stateRef.current?.clipSegments;
    if (!segs) return;
    const newSegs = segs.map((s) => {
      if (s.id !== segmentId) return s;
      return { ...s, start: Math.max(0, newStart), end: Math.min(clip?.duration_seconds || 0, newEnd) };
    }).filter((s) => s.end - s.start > 0.1);
    if (newSegs.length > 0) {
      updateEditState({ clipSegments: newSegs });
    }
  }, [updateEditState, clip]);

  const handleSeek = useCallback((time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveMutation.mutate(stateToSave, {
          onSuccess: () => toast({ title: "Saved", type: "success" }),
          onError: () => toast({ title: "Save failed", type: "error" }),
        });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        splitSegment(sourceToOutput(clipSegments, currentTime));
        return;
      }
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        togglePlay();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedSegmentId && clipSegments.length > 1) {
        e.preventDefault();
        deleteSegment(selectedSegmentId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, saveMutation, stateToSave, toast, togglePlay, selectedSegmentId, deleteSegment, clipSegments, currentTime, splitSegment]);

  const handleExport = useCallback(() => {
    const preset = historyState?.captionPreset || "classic";
    const config = historyState?.captionConfig || {};
    updateCaption.mutate(
      { clipId, projectId, style: "classic", preset, position: "", captionConfig: config },
      {
        onSuccess: () => {
          regenerate.mutate(
            { clipId, projectId, settings: { captionStyle: "classic", captionPreset: preset, captionConfig: config } },
            {
              onSuccess: () => toast({ title: "Re-rendering with your caption settings", type: "info" }),
              onError: () => toast({ title: "Re-render failed", type: "error" }),
            }
          );
        },
        onError: () => toast({ title: "Failed to save caption settings", type: "error" }),
      }
    );
  }, [clipId, projectId, historyState, updateCaption, regenerate, toast]);

  useEffect(() => {
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, []);

  const handleTimeUpdate = useCallback((sourceTime) => {
    setCurrentTime(sourceTime);
    const outTime = sourceToOutput(clipSegments, sourceTime);
    if (!transcript?.segments) return;
    const segs = transcript.segments;
    for (let i = 0; i < segs.length; i++) {
      if (sourceTime >= segs[i].start && sourceTime <= segs[i].end) {
        setActiveCaptionIndex(i);
        const segWords = segs[i].words;
        if (segWords && segWords.length > 0) {
          for (let w = 0; w < segWords.length; w++) {
            if (sourceTime >= segWords[w].start && sourceTime <= segWords[w].end) {
              setActiveWordIndex(w);
              return;
            }
          }
          setActiveWordIndex(-1);
        } else {
          setActiveWordIndex(-1);
        }
        return;
      }
    }
    setActiveCaptionIndex(-1);
    setActiveWordIndex(-1);
  }, [transcript, clipSegments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !clip) {
    return (
      <EmptyState
        icon={<Settings2 className="w-8 h-8" />}
        title="Clip not found"
        description="This clip may have been deleted or you don't have access."
        action={{ onClick: () => navigate(-1), children: "Go Back" }}
      />
    );
  }

  const duration = clip.duration_seconds || 0;
  const captionConfig = historyState?.captionConfig || getCaptionPresetStyle(historyState?.captionPreset || "classic");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* Top bar */}
      <div className="flex items-center justify-between h-12 px-4 bg-surface/80 backdrop-blur-glass border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-text truncate">
              {clip.clip_metadata?.[0]?.title || clip.title || "Clip Editor"}
            </h1>
            <p className="text-[11px] text-text-muted truncate">
              {project?.title} · {formatDuration(duration)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
            <Redo2 className="w-3.5 h-3.5" />
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => saveMutation.mutate(stateToSave, {
              onSuccess: () => toast({ title: "Saved", type: "success" }),
              onError: () => toast({ title: "Save failed", type: "error" }),
            })}
            loading={saveMutation.isPending}
          >
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
          <Button variant="primary" size="sm" className="h-8 text-xs" onClick={handleExport} loading={updateCaption.isPending || regenerate.isPending}>
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* Main content: 3-column layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar */}
        {leftOpen && (
          <div className="w-72 flex-shrink-0 border-r border-border bg-surface/50 overflow-y-auto">
            <EditorLeftSidebar
              clip={clip}
              transcript={transcript}
              editState={historyState}
              onUpdate={updateEditState}
              duration={duration}
            />
          </div>
        )}

        {/* Center: Video + Timeline */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Video preview */}
          <div className="flex-1 flex items-center justify-center bg-black/40 p-4 min-h-0">
            <div
              className="relative max-h-full cursor-pointer"
              style={{ aspectRatio: "9/16", maxHeight: "100%" }}
              onClick={togglePlay}
            >
              <EditorVideoPreview
                ref={videoRef}
                clip={clip}
                transcript={transcript}
                captionConfig={captionConfig}
                captionPreset={historyState?.captionPreset || "classic"}
                currentTime={currentTime}
                playing={playing}
                activeCaptionIndex={activeCaptionIndex}
                activeWordIndex={activeWordIndex}
                totalDuration={totalDuration}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
              {!playing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
                    <Play className="w-7 h-7 text-white ml-1" fill="white" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="relative flex-shrink-0 h-48 border-t border-border bg-surface/50">
            <CanvasTimeline
              duration={duration}
              currentTime={currentTime}
              clipSegments={clipSegments}
              selectedSegmentId={selectedSegmentId}
              onSelectSegment={setSelectedSegmentId}
              onSplitSegment={splitSegment}
              onDeleteSegment={deleteSegment}
              onTrimSegment={trimSegment}
              segments={transcript?.segments || []}
              playing={playing}
              onSeek={handleSeek}
              onTogglePlay={togglePlay}
            />
          </div>
        </div>

        {/* Right sidebar */}
        {rightOpen && (
          <div className="w-72 flex-shrink-0 border-l border-border bg-surface/50 overflow-y-auto">
            <EditorRightSidebar
              editState={historyState}
              onUpdate={updateEditState}
              clip={clip}
              transcript={transcript}
            />
          </div>
        )}
      </div>

      {/* Sidebar toggle buttons (floating) */}
      <button
        onClick={() => setLeftOpen(!leftOpen)}
        className={cn(
          "fixed left-0 top-1/2 -translate-y-1/2 z-30 w-5 h-10 rounded-r-lg bg-surface border border-l-0 border-border text-text-muted hover:text-text transition-all",
          leftOpen ? "translate-x-72" : "translate-x-0"
        )}
        title={leftOpen ? "Hide left panel" : "Show left panel"}
      >
        <span className="text-[10px]">{leftOpen ? "‹" : "›"}</span>
      </button>
      <button
        onClick={() => setRightOpen(!rightOpen)}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-30 w-5 h-10 rounded-l-lg bg-surface border border-r-0 border-border text-text-muted hover:text-text transition-all",
          rightOpen ? "-translate-x-72" : "translate-x-0"
        )}
        title={rightOpen ? "Hide right panel" : "Show right panel"}
      >
        <span className="text-[10px]">{rightOpen ? "›" : "‹"}</span>
      </button>
    </div>
  );
}
