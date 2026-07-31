import { useState, useEffect, useMemo } from "react";
import { cn } from "../../../lib/utils";
import { getCaptionPresetStyle } from "../../../lib/captionPresets";

const DEFAULT_CONFIG = {
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

const PREVIEW_W = 216;
const PREVIEW_H = 384;
const SCALE = PREVIEW_W / 1080;

function measureWordWidth(word, fontSize, fontWeight, letterSpacing) {
  const baseRatio = fontWeight >= 700 ? 0.58 : 0.52;
  const charW = fontSize * baseRatio;
  const cleanLen = word.replace(/[^a-zA-Z0-9]/g, "").length || 1;
  const punctLen = word.length - cleanLen;
  return cleanLen * charW + punctLen * (charW * 0.3) + letterSpacing * Math.max(0, word.length - 1);
}

function computePreviewLayout(words, config) {
  if (!words || words.length === 0) return [];

  const fW = PREVIEW_W / SCALE;
  const usableWidth = fW * (config.maxWidthPct / 100) - config.paddingX * 2;
  const fontSize = config.fontSize;
  const spaceW = measureWordWidth(" ", fontSize, config.fontWeight, config.letterSpacing);

  const lines = [];
  let currentLine = [];
  let currentWidth = 0;

  for (const word of words) {
    const ww = measureWordWidth(word, fontSize, config.fontWeight, config.letterSpacing);
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

  const maxLines = config.maxLines;
  while (lines.length > maxLines && lines.length > 1) {
    const mergeIdx = lines.length - 2;
    lines[mergeIdx] = {
      words: [...lines[mergeIdx].words, ...lines[mergeIdx + 1].words],
      width: lines[mergeIdx].width + spaceW + lines[mergeIdx + 1].width,
    };
    lines.pop();
  }

  const lineH = fontSize * config.lineHeight;
  const totalH = lines.length * lineH;
  const fH = PREVIEW_H / SCALE;
  let startY = fH * (1 - config.verticalPct / 100) - totalH / 2;

  // Keep the caption baseline inside the same vertical safe zone the renderer
  // enforces (Y 200-1420 at the 1080x1920 reference frame), so the preview
  // never shows captions where they can't be rendered.
  const SAFE_TOP = 200;
  const SAFE_BOTTOM = 1420;
  const lastBaseline = startY + (lines.length - 1) * lineH + fontSize * 0.8 + fontSize * 0.2;
  const clampedBaseline = Math.min(SAFE_BOTTOM, Math.max(SAFE_TOP, lastBaseline));
  startY = clampedBaseline - (lines.length - 1) * lineH - fontSize;

  const result = [];
  lines.forEach((line, li) => {
    let x;
    const y = startY + li * lineH + fontSize * 0.8;
    if (config.horizontalAlign === "left") x = config.paddingX;
    else if (config.horizontalAlign === "right") x = fW - config.paddingX - line.width;
    else x = (fW - line.width) / 2;

    for (const word of line.words) {
      const ww = measureWordWidth(word, fontSize, config.fontWeight, config.letterSpacing);
      result.push({
        word,
        x: x * SCALE,
        y: y * SCALE,
        w: ww * SCALE,
        h: fontSize * SCALE,
        lineIndex: li,
      });
      x += ww + spaceW;
    }
  });

  return result;
}

function getAnimClass(animType) {
  switch (animType) {
    case "pop": return "caption-anim-pop";
    case "bounce": return "caption-anim-bounce";
    case "fade": return "caption-anim-fade";
    default: return "";
  }
}

export default function CaptionPreview({ words = [], config = {}, preset, activeIndex = -1, playing = false, className }) {
  const effectiveConfig = useMemo(() => {
    if (preset) return getCaptionPresetStyle(preset, config);
    return { ...DEFAULT_CONFIG, ...config };
  }, [preset, config]);

  const layout = useMemo(() => computePreviewLayout(words, effectiveConfig), [words, effectiveConfig]);

  const textShadow = effectiveConfig.shadowDepth > 0
    ? `${effectiveConfig.shadowDepth * SCALE}px ${effectiveConfig.shadowDepth * SCALE * 1.5}px ${effectiveConfig.shadowDepth * SCALE * 2}px ${effectiveConfig.shadowColor}`
    : "none";

  const glowShadow = effectiveConfig.highlightGlow
    ? `0 0 ${effectiveConfig.highlightGlowIntensity * SCALE * 6}px ${effectiveConfig.highlightGlowColor}`
    : "none";

  const animClass = getAnimClass(effectiveConfig.animType);

  return (
    <div
      className={cn("relative rounded-xl overflow-hidden bg-black border border-border", className)}
      style={{ width: PREVIEW_W, height: PREVIEW_H }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-surface-subtle/20 to-surface-subtle/40" />

      {layout.map((w, i) => {
        const isActive = i === activeIndex;
        const scale = isActive ? effectiveConfig.highlightScale : 1;
        const color = isActive ? effectiveConfig.highlightColor : effectiveConfig.textColor;
        const duration = isActive ? effectiveConfig.animIn : effectiveConfig.animOut;

        return (
          <span
            key={`${w.word}-${i}`}
            className={cn(
              "absolute whitespace-nowrap select-none pointer-events-none",
              playing && "transition-transform",
              animClass && isActive && animClass
            )}
            style={{
              left: w.x,
              top: w.y,
              fontFamily: `"${effectiveConfig.fontName}", sans-serif`,
              fontSize: effectiveConfig.fontSize * SCALE,
              fontWeight: effectiveConfig.fontWeight,
              color,
              letterSpacing: effectiveConfig.letterSpacing * SCALE,
              textShadow: isActive ? `${glowShadow}, ${textShadow}` : textShadow,
              WebkitTextStroke: `${effectiveConfig.outlineWidth * SCALE}px ${effectiveConfig.outlineColor}`,
              paintOrder: "stroke fill",
              transform: `scale(${scale})`,
              transformOrigin: "center center",
              lineHeight: 1,
              transition: `color ${duration}ms ease, transform ${duration}ms ease`,
              ...(isActive && effectiveConfig.highlightBg ? {
                backgroundColor: effectiveConfig.highlightBg,
                borderRadius: effectiveConfig.highlightRadius * SCALE,
                padding: `${2 * SCALE}px ${4 * SCALE}px`,
              } : {}),
            }}
          >
            {w.word}
          </span>
        );
      })}

      <div className="absolute bottom-1 right-1.5 text-[8px] text-white/30 font-mono">PREVIEW</div>
    </div>
  );
}

export { DEFAULT_CONFIG as DEFAULT_PREVIEW_CONFIG };
