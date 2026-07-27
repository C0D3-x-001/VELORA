import { forwardRef, useEffect, useCallback, useRef, useMemo, useState } from "react";
import { cn } from "../../lib/utils";
import { getCaptionPresetStyle } from "../../lib/captionPresets";

const measureWordWidth = (word, fontSize, fontWeight, letterSpacing) => {
  const baseRatio = fontWeight >= 700 ? 0.58 : 0.52;
  const charW = fontSize * baseRatio;
  const cleanLen = word.replace(/[^a-zA-Z0-9]/g, "").length || 1;
  const punctLen = word.length - cleanLen;
  return cleanLen * charW + punctLen * (charW * 0.3) + letterSpacing * Math.max(0, word.length - 1);
};

function computeOverlayLayout(words, config, containerW, containerH) {
  if (!words || words.length === 0 || !containerW || !containerH) return { items: [], scale: 1 };

  const scaleX = containerW / 1080;
  const scaleY = containerH / 1920;
  const scale = Math.min(scaleX, scaleY);
  const frameW = 1080;
  const frameH = 1920;

  const usableWidth = frameW * (config.maxWidthPct / 100) - (config.paddingX || 0) * 2;
  const fontSize = config.fontSize;
  const spaceW = measureWordWidth(" ", fontSize, config.fontWeight, config.letterSpacing || 0);

  const lines = [];
  let currentLine = [];
  let currentWidth = 0;

  for (const word of words) {
    const ww = measureWordWidth(word, fontSize, config.fontWeight, config.letterSpacing || 0);
    const testW = currentLine.length === 0 ? ww : currentWidth + spaceW + ww;
    if (testW > usableWidth && currentLine.length > 0) {
      lines.push({ words: currentLine, width: currentWidth });
      currentLine = [word];
      currentWidth = ww;
    } else {
      currentLine.push(word);
      currentWidth = testW;
    }
  }
  if (currentLine.length > 0) lines.push({ words: currentLine, width: currentWidth });

  const maxLines = config.maxLines || 2;
  while (lines.length > maxLines && lines.length > 1) {
    const mergeIdx = lines.length - 2;
    lines[mergeIdx] = {
      words: [...lines[mergeIdx].words, ...lines[mergeIdx + 1].words],
      width: lines[mergeIdx].width + spaceW + lines[mergeIdx + 1].width,
    };
    lines.pop();
  }

  const lineH = fontSize * (config.lineHeight || 1.3);
  const totalH = lines.length * lineH;
  const startY = frameH * (1 - (config.verticalPct || 50) / 100) - totalH / 2;

  const result = [];
  lines.forEach((line, li) => {
    let x;
    const y = startY + li * lineH + fontSize * 0.8;
    if (config.horizontalAlign === "left") x = config.paddingX || 0;
    else if (config.horizontalAlign === "right") x = frameW - (config.paddingX || 0) - line.width;
    else x = (frameW - line.width) / 2;

    for (const word of line.words) {
      const ww = measureWordWidth(word, fontSize, config.fontWeight, config.letterSpacing || 0);
      result.push({
        word,
        x: x * scale,
        y: y * scale,
        w: ww * scale,
        h: fontSize * scale,
        lineIndex: li,
      });
      x += ww + spaceW;
    }
  });

  return { items: result, scale };
}

function getAnimClass(animType) {
  switch (animType) {
    case "pop": return "caption-anim-pop";
    case "bounce": return "caption-anim-bounce";
    case "fade": return "caption-anim-fade";
    default: return "";
  }
}

const EditorVideoPreview = forwardRef(function EditorVideoPreview(
  {
    clip,
    transcript,
    captionConfig,
    captionPreset,
    currentTime,
    playing,
    activeCaptionIndex,
    activeWordIndex,
    totalDuration,
    onTimeUpdate,
    onPlay,
    onPause,
    className,
  },
  ref
) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const prevWordRef = useRef({ wordIdx: -1, segIdx: -1 });

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (ref?.current) {
      onTimeUpdate?.(ref.current.currentTime);
    }
  }, [onTimeUpdate, ref]);

  const handleEnded = useCallback(() => {
    onPause?.();
  }, [onPause]);

  const effectiveConfig = useMemo(() => {
    return getCaptionPresetStyle(captionPreset, captionConfig);
  }, [captionPreset, captionConfig]);

  const words = useMemo(() => {
    if (!transcript?.segments || activeCaptionIndex < 0) return [];
    const seg = transcript.segments[activeCaptionIndex];
    if (!seg?.words) return seg?.text?.split(/\s+/) || [];
    return seg.words.map((w) => w.word);
  }, [transcript, activeCaptionIndex]);

  const overlayLayout = useMemo(() => {
    return computeOverlayLayout(words, effectiveConfig, dims.w, dims.h);
  }, [words, effectiveConfig, dims.w, dims.h]);

  const isActive = activeWordIndex >= 0 && overlayLayout.items.length > 0;
  const wordChanged = isActive && (activeWordIndex !== prevWordRef.current.wordIdx || activeCaptionIndex !== prevWordRef.current.segIdx);

  useEffect(() => {
    if (isActive) {
      prevWordRef.current = { wordIdx: activeWordIndex, segIdx: activeCaptionIndex };
    }
  }, [isActive, activeWordIndex, activeCaptionIndex]);

  const textShadow = effectiveConfig.shadowDepth > 0
    ? `${effectiveConfig.shadowDepth * 0.7}px ${effectiveConfig.shadowDepth * 0.7}px ${effectiveConfig.shadowDepth}px ${effectiveConfig.shadowColor}`
    : "none";

  const glowShadow = effectiveConfig.highlightGlow
    ? `0 0 ${effectiveConfig.highlightGlowIntensity}px ${effectiveConfig.highlightGlowColor}`
    : "none";

  const animClass = getAnimClass(effectiveConfig.animType);

  return (
    <div ref={containerRef} className={cn("relative bg-black rounded-xl overflow-hidden shadow-2xl", className)}>
      {clip.video_url ? (
        <video
          ref={ref}
          src={clip.video_url}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={handleEnded}
          playsInline
          preload="auto"
        />
      ) : clip.thumbnail_url ? (
        <img src={clip.thumbnail_url} alt="" className="w-full h-full object-contain" />
      ) : null}

      {/* Caption overlay */}
      {overlayLayout.items.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {overlayLayout.items.map((w, i) => {
            const wordActive = i === activeWordIndex && activeCaptionIndex >= 0;
            const wordScale = wordActive ? effectiveConfig.highlightScale : 1;
            const wordColor = wordActive ? effectiveConfig.highlightColor : effectiveConfig.textColor;
            const wordShadow = wordActive && effectiveConfig.highlightGlow
              ? `${glowShadow}, ${textShadow}`
              : textShadow;
            const duration = wordActive ? effectiveConfig.animIn : effectiveConfig.animOut;

            return (
              <span
                key={`${activeCaptionIndex}-${i}-${w.word}`}
                className={cn(
                  "absolute whitespace-nowrap select-none",
                  animClass && wordChanged && wordActive && animClass
                )}
                style={{
                  left: w.x,
                  top: w.y,
                  fontFamily: `"${effectiveConfig.fontName}", sans-serif`,
                  fontSize: w.h,
                  fontWeight: effectiveConfig.fontWeight,
                  color: wordColor,
                  letterSpacing: (effectiveConfig.letterSpacing || 0) * overlayLayout.scale,
                  textShadow: wordShadow,
                  WebkitTextStroke: `${(effectiveConfig.outlineWidth || 0) * overlayLayout.scale}px ${effectiveConfig.outlineColor || "transparent"}`,
                  paintOrder: "stroke fill",
                  lineHeight: 1,
                  transform: `scale(${wordScale})`,
                  transformOrigin: "center center",
                  transition: `color ${duration}ms ease, transform ${duration}ms ease, text-shadow ${duration}ms ease`,
                  ...(wordActive && effectiveConfig.highlightBg ? {
                    backgroundColor: effectiveConfig.highlightBg,
                    borderRadius: (effectiveConfig.highlightRadius || 0) * overlayLayout.scale,
                    padding: `${2 * overlayLayout.scale}px ${4 * overlayLayout.scale}px`,
                  } : {}),
                }}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      )}

      {/* Time display */}
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-[11px] font-mono text-white/80 px-2 py-1 rounded-md">
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </div>
    </div>
  );
});

function formatTime(seconds) {
  if (!seconds || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default EditorVideoPreview;
