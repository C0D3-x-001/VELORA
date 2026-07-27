import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatNumber(num) {
  if (!num && num !== 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatCredits(credits) {
  return `${formatNumber(credits)} credits`;
}

export function calculateCredits({ clipCount, clipDuration }, pricing = null) {
  const costs = pricing?.costs || { clip: { '15s': 5, '30s': 10, '45s': 12, '60s': 15, '90s': 20, '120s': 25 } };
  let durationKey;
  const dur = clipDuration ?? 120;
  if (dur <= 15) durationKey = '15s';
  else if (dur <= 30) durationKey = '30s';
  else if (dur <= 45) durationKey = '45s';
  else if (dur <= 60) durationKey = '60s';
  else if (dur <= 90) durationKey = '90s';
  else durationKey = '120s';
  const perClip = costs.clip[durationKey] ?? costs.clip?.['60s'] ?? 15;
  return clipCount * perClip;
}

export function getViralScoreColor(score) {
  if (score >= 80) return "text-highlight";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-accent";
  return "text-text-secondary";
}

export function getViralScoreLabel(score) {
  if (score >= 80) return "Viral Potential";
  if (score >= 60) return "High Engagement";
  if (score >= 40) return "Good Potential";
  return "Needs Work";
}

export function getViralScoreBg(score) {
  if (score >= 80) return "bg-highlight/20 border-highlight/30";
  if (score >= 60) return "bg-primary/20 border-primary/30";
  if (score >= 40) return "bg-accent/20 border-accent/30";
  return "bg-surface-subtle border-border";
}

export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.message) return err.message;
  return fallback;
}