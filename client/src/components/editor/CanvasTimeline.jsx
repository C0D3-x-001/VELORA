import { useRef, useEffect, useCallback, useState } from "react";
import { Play, Pause, ZoomIn, ZoomOut, Scissors, Trash2 } from "lucide-react";
import { cn, formatDuration } from "../../lib/utils";

if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    var rad = typeof r === "number" ? r : (Array.isArray(r) ? r[0] || 0 : 0);
    this.moveTo(x + rad, y);
    this.arcTo(x + w, y, x + w, y + h, rad);
    this.arcTo(x + w, y + h, x, y + h, rad);
    this.arcTo(x, y + h, x, y, rad);
    this.arcTo(x, y, x + w, y, rad);
    this.closePath();
    return this;
  };
}

const COLORS = {
  bg: "#12121e",
  rulerBg: "#181828",
  track: "#1a1a24",
  trackBorder: "#2a2a3a",
  wave: "#7c5eff",
  waveFill: "rgba(124,94,255,0.40)",
  playhead: "#ef4444",
  playheadTip: "#ef4444",
  selectedBorder: "#3b82f6",
  selectedBg: "#263a5e",
  segmentBg: "#2a3a5a",
  segmentBorder: "#3a5080",
  gapBg: "#0e0e18",
  handleColor: "#7c5eff",
  handleGrip: "#ffffff",
  trimDimmed: "rgba(0,0,0,0.55)",
  trimDimmedBorder: "rgba(239,68,68,0.5)",
  textMuted: "#9898aa",
  textSegment: "#c0c0d0",
  tick: "#333348",
  tickMajor: "#555568",
  hintBg: "rgba(124,94,255,0.08)",
  hintBorder: "rgba(124,94,255,0.25)",
};

function outputDuration(segments) {
  return segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
}

function sourceToOutputTime(clipSegments, srcTime) {
  let elapsed = 0;
  for (const seg of clipSegments) {
    if (srcTime < seg.end) return elapsed + Math.max(0, srcTime - seg.start);
    elapsed += seg.end - seg.start;
  }
  return elapsed;
}

function drawTimeline(ctx, canvas, state) {
  const { clipSegments, selectedSegmentId, currentTime, duration, segments, scrollX, zoom, dragging } = state;
  const w = canvas.width;
  const h = canvas.height;
  const dpr = window.devicePixelRatio || 1;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  try {
    ctx.scale(dpr, dpr);
    const cw = w / dpr;
    const ch = h / dpr;

    if (cw < 1 || ch < 1) { return; }

    const RULER_H = 28;
    const CONTROLS_H = 44;
    const TRACK_TOP = RULER_H;
    const TRACK_BOTTOM = ch - CONTROLS_H;
    const TRACK_H = Math.max(0, TRACK_BOTTOM - TRACK_TOP);

    const totalDur = Math.max(outputDuration(clipSegments), 0.001);
    const pixelsPerSecond = (cw * zoom) / totalDur;
    const timeToX = (t) => (t - scrollX) * pixelsPerSecond;
    const xToTime = (x) => x / pixelsPerSecond + scrollX;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = COLORS.rulerBg;
    ctx.fillRect(0, 0, cw, RULER_H);

    const rulerStep = zoom > 3 ? 0.5 : zoom > 1.5 ? 1 : zoom > 0.7 ? 2 : zoom > 0.3 ? 5 : 10;
    const startTime = Math.floor(scrollX / rulerStep) * rulerStep;
    const endTime = Math.min(totalDur, scrollX + cw / pixelsPerSecond);

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    for (let t = startTime; t <= endTime; t += rulerStep) {
      const x = timeToX(t);
      if (x < -20 || x > cw + 20) continue;
      const isMajor = rulerStep >= 2;
      ctx.strokeStyle = isMajor ? COLORS.tickMajor : COLORS.tick;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, RULER_H - (isMajor ? 8 : 4));
      ctx.lineTo(x, RULER_H);
      ctx.stroke();
      if (isMajor) {
        ctx.fillStyle = COLORS.textMuted;
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        ctx.fillText(m + ":" + String(s).padStart(2, "0"), x, 14);
      }
    }

    let outputOffset = 0;
    for (let si = 0; si < clipSegments.length; si++) {
      const seg = clipSegments[si];
      const segDur = seg.end - seg.start;
      const segOutStart = outputOffset;
      const segOutEnd = outputOffset + segDur;
      const isSelected = seg.id === selectedSegmentId;

      const sx = timeToX(segOutStart);
      const ex = timeToX(segOutEnd);

      if (ex >= 0 && sx <= cw) {
        const cs = Math.max(0, sx);
        const ce = Math.min(cw, ex);
        const blockW = ce - cs;

        ctx.fillStyle = isSelected ? COLORS.selectedBg : COLORS.segmentBg;
        ctx.fillRect(cs, TRACK_TOP + 2, blockW, TRACK_H - 4);

        ctx.strokeStyle = isSelected ? COLORS.selectedBorder : COLORS.segmentBorder;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(cs, TRACK_TOP + 2, blockW, TRACK_H - 4);

        const waveAmp = TRACK_H * 0.5;
        const centerY = TRACK_TOP + TRACK_H / 2;

        ctx.beginPath();
        for (let x = cs; x <= ce; x++) {
          const outT = xToTime(x);
          let e2 = 0;
          let srcT = 0;
          for (const s2 of clipSegments) {
            const d2 = s2.end - s2.start;
            if (outT <= e2 + d2) { srcT = s2.start + (outT - e2); break; }
            e2 += d2;
          }
          const progress = segDur > 0 ? (srcT - seg.start) / segDur : 0;
          const amp = Math.sin(progress * Math.PI) * 0.7 + 0.3;
          if (x === cs) ctx.moveTo(x, centerY - amp * waveAmp / 2);
          else ctx.lineTo(x, centerY - amp * waveAmp / 2);
        }
        for (let x2 = ce; x2 >= cs; x2--) {
          const outT2 = xToTime(x2);
          let e3 = 0;
          let srcT2 = 0;
          for (const s3 of clipSegments) {
            const d3 = s3.end - s3.start;
            if (outT2 <= e3 + d3) { srcT2 = s3.start + (outT2 - e3); break; }
            e3 += d3;
          }
          const progress2 = segDur > 0 ? (srcT2 - seg.start) / segDur : 0;
          const amp2 = Math.sin(progress2 * Math.PI) * 0.7 + 0.3;
          ctx.lineTo(x2, centerY + amp2 * waveAmp / 2);
        }
        ctx.closePath();
        ctx.fillStyle = COLORS.waveFill;
        ctx.fill();
        ctx.strokeStyle = COLORS.wave;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (blockW > 40) {
          ctx.fillStyle = COLORS.textSegment;
          ctx.font = 'bold 11px "Inter", sans-serif';
          ctx.textAlign = "left";
          const label = "Segment " + (si + 1);
          ctx.fillText(label, cs + 8, TRACK_TOP + 18);

          ctx.fillStyle = COLORS.textMuted;
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillText(formatDuration(segDur), cs + 8, TRACK_TOP + 32);
        }

        if (isSelected) {
          const handleW = 8;
          const gripCY = TRACK_TOP + TRACK_H / 2;
          ctx.fillStyle = COLORS.handleColor;
          ctx.fillRect(cs - handleW / 2, TRACK_TOP + 4, handleW, TRACK_H - 8);
          ctx.fillRect(ce - handleW / 2, TRACK_TOP + 4, handleW, TRACK_H - 8);

          ctx.fillStyle = COLORS.handleGrip;
          [cs, ce].forEach(function(gx) {
            for (var i = -2; i <= 2; i++) {
              ctx.beginPath();
              ctx.arc(gx, gripCY + i * 5, 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
          });
        }
      }

      if (si < clipSegments.length - 1) {
        const gapX = timeToX(segOutEnd);
        if (gapX >= -10 && gapX <= cw + 10) {
          ctx.strokeStyle = COLORS.segmentBorder;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(gapX, TRACK_TOP + 4);
          ctx.lineTo(gapX, TRACK_BOTTOM - 4);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      outputOffset += segDur;
    }

    if (dragging && dragging.type === "trim" && dragging.segmentId) {
      let dElapsed = 0;
      for (let di = 0; di < clipSegments.length; di++) {
        const ds = clipSegments[di];
        const dsDur = ds.end - ds.start;
        if (ds.id === dragging.segmentId) {
          const origStartOut = dElapsed + (dragging.origStart - ds.start);
          const origEndOut = dElapsed + (dragging.origEnd - ds.start);
          const curStartOut = dElapsed;
          const curEndOut = dElapsed + dsDur;

          if (dragging.handle === "start") {
            const dimLeftX = timeToX(Math.min(origStartOut, curStartOut));
            const dimRightX = timeToX(Math.max(origStartOut, curStartOut));
            const clampedL = Math.max(0, dimLeftX);
            const clampedR = Math.min(cw, dimRightX);
            if (clampedR > clampedL) {
              ctx.fillStyle = COLORS.trimDimmed;
              ctx.fillRect(clampedL, TRACK_TOP + 2, clampedR - clampedL, TRACK_H - 4);
              ctx.strokeStyle = COLORS.trimDimmedBorder;
              ctx.lineWidth = 1;
              ctx.setLineDash([4, 3]);
              ctx.strokeRect(clampedL, TRACK_TOP + 2, clampedR - clampedL, TRACK_H - 4);
              ctx.setLineDash([]);
            }
          } else {
            const dimLeftX = timeToX(Math.min(origEndOut, curEndOut));
            const dimRightX = timeToX(Math.max(origEndOut, curEndOut));
            const clampedL = Math.max(0, dimLeftX);
            const clampedR = Math.min(cw, dimRightX);
            if (clampedR > clampedL) {
              ctx.fillStyle = COLORS.trimDimmed;
              ctx.fillRect(clampedL, TRACK_TOP + 2, clampedR - clampedL, TRACK_H - 4);
              ctx.strokeStyle = COLORS.trimDimmedBorder;
              ctx.lineWidth = 1;
              ctx.setLineDash([4, 3]);
              ctx.strokeRect(clampedL, TRACK_TOP + 2, clampedR - clampedL, TRACK_H - 4);
              ctx.setLineDash([]);
            }
          }
          break;
        }
        dElapsed += dsDur;
      }
    }

    if (clipSegments.length === 1 && !selectedSegmentId) {
      var hintY = TRACK_TOP + TRACK_H / 2;
      var hintX = cw / 2;
      var hintText = "Click to select \u00b7 Drag edges to trim \u00b7 Scissors to split";
      ctx.font = '12px "Inter", sans-serif';
      ctx.textAlign = "center";
      var hintW = ctx.measureText(hintText).width + 32;
      ctx.fillStyle = COLORS.hintBg;
      ctx.strokeStyle = COLORS.hintBorder;
      ctx.lineWidth = 1;
      var rx = hintX - hintW / 2;
      var ry = hintY - 14;
      ctx.beginPath();
      ctx.roundRect(rx, ry, hintW, 28, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText(hintText, hintX, hintY + 4);
    }

    var phX = timeToX(sourceToOutputTime(clipSegments, currentTime));
    if (phX >= 0 && phX <= cw) {
      ctx.strokeStyle = COLORS.playhead;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(phX, 0);
      ctx.lineTo(phX, TRACK_BOTTOM);
      ctx.stroke();
      ctx.fillStyle = COLORS.playheadTip;
      ctx.beginPath();
      ctx.moveTo(phX - 6, 0);
      ctx.lineTo(phX + 6, 0);
      ctx.lineTo(phX, 8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = COLORS.track;
    ctx.fillRect(0, TRACK_BOTTOM, cw, CONTROLS_H);
    ctx.strokeStyle = COLORS.trackBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, TRACK_BOTTOM);
    ctx.lineTo(cw, TRACK_BOTTOM);
    ctx.stroke();
  } finally {
    ctx.restore();
  }
}

export default function CanvasTimeline({
  duration,
  currentTime,
  clipSegments = [],
  selectedSegmentId,
  onSelectSegment,
  onSplitSegment,
  onDeleteSegment,
  onTrimSegment,
  segments,
  playing,
  onSeek,
  onTogglePlay,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const canvasWrapperRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [scrollX, setScrollX] = useState(0);
  const [dragging, setDragging] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [hoveringHandle, setHoveringHandle] = useState(false);

  var dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  var totalDur = outputDuration(clipSegments);

  var drawStateRef = useRef({
    clipSegments: clipSegments, selectedSegmentId: selectedSegmentId,
    currentTime: currentTime, duration: duration, segments: segments || [],
    scrollX: scrollX, zoom: zoom, dragging: dragging,
  });
  drawStateRef.current = {
    clipSegments: clipSegments, selectedSegmentId: selectedSegmentId,
    currentTime: currentTime, duration: duration, segments: segments || [],
    scrollX: scrollX, zoom: zoom, dragging: dragging,
  };

  useEffect(function() {
    var canvas = canvasRef.current;
    var wrapper = canvasWrapperRef.current;
    if (!canvas || !wrapper) return;
    var resize = function() {
      var rect = wrapper.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      console.log("[CanvasTimeline] resize:", rect.width, rect.height, "canvas:", canvas.width, canvas.height);
      setCanvasSize({ w: rect.width, h: rect.height });
      if (rect.width > 0 && rect.height > 0) {
        var ctx = canvas.getContext("2d");
        drawTimeline(ctx, canvas, drawStateRef.current);
      }
    };
    resize();
    var rafId = requestAnimationFrame(resize);
    var obs = new ResizeObserver(resize);
    obs.observe(wrapper);
    return function() { obs.disconnect(); cancelAnimationFrame(rafId); };
  }, [dpr]);

  useEffect(function() {
    var canvas = canvasRef.current;
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    console.log("[CanvasTimeline] draw:", canvas.width, canvas.height, "segments:", clipSegments.length);
    drawTimeline(ctx, canvas, {
      clipSegments: clipSegments, selectedSegmentId: selectedSegmentId,
      currentTime: currentTime, duration: duration, segments: segments || [],
      scrollX: scrollX, zoom: zoom, dragging: dragging,
    });
  }, [duration, currentTime, clipSegments, selectedSegmentId, segments, scrollX, zoom, canvasSize, dragging]);

  var safeDur = Math.max(totalDur, 0.001);

  var getTimeFromX = useCallback(function(clientX) {
    var canvas = canvasRef.current;
    if (!canvas) return 0;
    var rect = canvas.getBoundingClientRect();
    var x = clientX - rect.left;
    var pps = (rect.width * zoom) / safeDur;
    return Math.max(0, Math.min(safeDur, x / pps + scrollX));
  }, [safeDur, zoom, scrollX]);

  var getSegmentAtX = useCallback(function(clientX) {
    var canvas = canvasRef.current;
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    var x = clientX - rect.left;
    var pps = (rect.width * zoom) / safeDur;
    var outputTime = x / pps + scrollX;

    let elapsed = 0;
    for (const seg of clipSegments) {
      const d = seg.end - seg.start;
      if (outputTime >= elapsed && outputTime <= elapsed + d) return seg;
      elapsed += d;
    }
    return null;
  }, [clipSegments, safeDur, zoom, scrollX]);

  var getTrimHandle = useCallback(function(clientX) {
    if (!selectedSegmentId) return null;
    var canvas = canvasRef.current;
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    var x = clientX - rect.left;
    var pps = (rect.width * zoom) / safeDur;

    let elapsed = 0;
    for (const seg of clipSegments) {
      const segDur = seg.end - seg.start;
      const segOutStart = elapsed;
      const segOutEnd = elapsed + segDur;
      if (seg.id === selectedSegmentId) {
        const startX = (segOutStart - scrollX) * pps;
        const endX = (segOutEnd - scrollX) * pps;
        if (Math.abs(x - startX) < 12) return { handle: "start", segmentId: seg.id };
        if (Math.abs(x - endX) < 12) return { handle: "end", segmentId: seg.id };
        return null;
      }
      elapsed += segDur;
    }
    return null;
  }, [clipSegments, selectedSegmentId, safeDur, zoom, scrollX]);

  var handleCanvasHover = useCallback(function(e) {
    if (dragging) return;
    setHoveringHandle(!!getTrimHandle(e.clientX));
  }, [getTrimHandle, dragging]);

  var handleMouseDown = useCallback(function(e) {
    const handleInfo = getTrimHandle(e.clientX);
    if (handleInfo) {
      const seg = clipSegments.find((s) => s.id === handleInfo.segmentId);
      if (seg) {
        setDragging({
          type: "trim",
          handle: handleInfo.handle,
          segmentId: handleInfo.segmentId,
          startX: e.clientX,
          origStart: seg.start,
          origEnd: seg.end,
        });
      }
    } else {
      var time = getTimeFromX(e.clientX);
      onSeek(time);
      const seg = getSegmentAtX(e.clientX);
      onSelectSegment(seg ? (seg.id === selectedSegmentId ? null : seg.id) : null);
      setDragging({ type: "scrub", startX: e.clientX });
    }
  }, [getTrimHandle, getSegmentAtX, getTimeFromX, onSeek, onSelectSegment, selectedSegmentId, clipSegments]);

  var handleMouseMove = useCallback(function(e) {
    if (!dragging) return;
    if (dragging.type === "trim") {
      var canvas = canvasRef.current;
      if (!canvas) return;
      var rect = canvas.getBoundingClientRect();
      var pps = (rect.width * zoom) / safeDur;
      var dx = e.clientX - dragging.startX;
      var dt = dx / pps;
      var maxDur = duration || 0;
      var newSeg = null;
      if (dragging.handle === "start") {
        var newStart = Math.max(0, Math.min(dragging.origEnd - 0.5, dragging.origStart + dt));
        onTrimSegment(dragging.segmentId, newStart, dragging.origEnd);
        newSeg = newStart;
      } else {
        var newEnd = Math.max(dragging.origStart + 0.5, Math.min(maxDur, dragging.origEnd + dt));
        onTrimSegment(dragging.segmentId, dragging.origStart, newEnd);
        newSeg = newEnd;
      }
      if (newSeg !== null) {
        onSeek(newSeg);
      }
    } else if (dragging.type === "scrub") {
      var time = getTimeFromX(e.clientX);
      onSeek(time);
    }
  }, [dragging, safeDur, zoom, duration, onTrimSegment, onSeek, getTimeFromX]);

  var handleMouseUp = useCallback(function() {
    setDragging(null);
  }, []);

  var handleWheel = useCallback(function(e) {
    if (e.ctrlKey || e.metaKey) {
      var delta = e.deltaY > 0 ? 0.8 : 1.25;
      setZoom(function(z) { return Math.max(0.2, Math.min(10, z * delta)); });
    } else {
      var scrollDelta = (e.deltaX || e.deltaY) / safeDur * 0.5;
      setScrollX(function(s) { return Math.max(0, Math.min(Math.max(0, totalDur - totalDur / zoom), s + scrollDelta)); });
    }
  }, [safeDur, totalDur, zoom]);

  useEffect(function() {
    var canvas = canvasRef.current;
    if (!canvas) return;
    var handler = function(e) { e.preventDefault(); handleWheel(e); };
    canvas.addEventListener("wheel", handler, { passive: false });
    return function() { canvas.removeEventListener("wheel", handler); };
  }, [handleWheel]);

  useEffect(function() {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return function() {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  var handleZoomIn = function() { setZoom(function(z) { return Math.min(10, z * 1.5); }); };
  var handleZoomOut = function() { setZoom(function(z) { return Math.max(0.2, z / 1.5); }); };

  var handleSplit = function() {
    onSplitSegment(sourceToOutputTime(clipSegments, currentTime));
  };

  var handleDelete = function() {
    if (selectedSegmentId) onDeleteSegment(selectedSegmentId);
  };

  var displayTime = (function() {
    var el = 0;
    for (var i = 0; i < clipSegments.length; i++) {
      if (currentTime < clipSegments[i].end) return el + Math.max(0, currentTime - clipSegments[i].start);
      el += clipSegments[i].end - clipSegments[i].start;
    }
    return el;
  })();

  return (
    <div ref={containerRef} className="absolute inset-0 flex flex-col">
      <div ref={canvasWrapperRef} className="flex-1 min-h-0 relative">
        <canvas
          ref={canvasRef}
          className={cn(
            "w-full h-full",
            dragging?.type === "trim" ? "cursor-col-resize" : hoveringHandle ? "cursor-col-resize" : "cursor-crosshair"
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleCanvasHover}
          onWheel={handleWheel}
        />
      </div>
      <div className="flex items-center justify-between h-11 px-3 border-t border-border bg-surface/80 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onTogglePlay} className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-surface-subtle transition-colors" title={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <span className="text-xs font-mono text-text-muted tabular-nums">
            {formatDuration(displayTime)} / {formatDuration(totalDur)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSplit}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
            title="Split at playhead"
          >
            <Scissors className="w-4 h-4" />
            <span className="text-[11px] font-medium hidden sm:inline">Split</span>
          </button>
          <button
            onClick={handleDelete}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors",
              selectedSegmentId && clipSegments.length > 1
                ? "text-red-400 hover:bg-red-500/10"
                : "text-text-muted opacity-30 cursor-not-allowed"
            )}
            title={clipSegments.length <= 1 ? "Cannot delete the only segment" : "Delete selected segment"}
            disabled={!selectedSegmentId || clipSegments.length <= 1}
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-[11px] font-medium hidden sm:inline">Delete</span>
          </button>
          <div className="w-px h-5 bg-border" />
          <span className="text-[11px] text-text-muted">
            {clipSegments.length} segment{clipSegments.length !== 1 ? "s" : ""}
          </span>
          <div className="w-px h-5 bg-border" />
          <button onClick={handleZoomOut} className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-subtle transition-colors" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-text-muted font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-subtle transition-colors" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
