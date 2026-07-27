export function segmentsToSRT(segments) {
  if (!segments || segments.length === 0) return "";

  let srt = "";
  segments.forEach((seg, i) => {
    const text = (seg.text || "").trim();
    if (!text) return;
    const start = formatSrtTime(seg.start);
    const end = formatSrtTime(seg.end);
    srt += `${i + 1}\n${start} --> ${end}\n${text}\n\n`;
  });
  return srt;
}

export function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, "0");
  return `${h}:${m}:${s},${ms}`;
}
