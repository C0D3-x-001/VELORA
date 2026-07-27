export function validateClipSettings(videoLengthSeconds, clipDuration, clipCount) {
  if (!videoLengthSeconds || videoLengthSeconds <= 0) {
    return {
      isValid: true,
      status: "info",
      issues: [],
      recommendations: [],
      autoAdjust: null,
      videoLength: 0,
      requestedClipLength: clipDuration,
      totalRequestedSeconds: 0,
      estimatedRealisticClips: 0,
    };
  }

  const totalRequestedSeconds = clipDuration * clipCount;
  const messages = [];
  let severity = "success"; // success, warning, error
  let canContinue = true;

  // CASE 1: Clip duration longer than video
  if (clipDuration > videoLengthSeconds) {
    messages.push({
      type: "error",
      title: "Clip duration exceeds video length",
      description: `The selected clip duration (${clipDuration}s) is longer than the source video (${videoLengthSeconds}s).`,
      action: "Reduce clip duration or choose a longer video.",
    });
    severity = "error";
    canContinue = false;
  }

  // CASE 2: Total requested time > 2x video length
  if (totalRequestedSeconds > videoLengthSeconds * 2) {
    messages.push({
      type: "warning",
      title: "High overlap likely",
      description: `You requested ${totalRequestedSeconds}s of clips from a ${videoLengthSeconds}s video. Velora prioritizes quality over duplicate clips.`,
      action: "Consider fewer clips or shorter duration for unique results.",
    });
    if (severity !== "error") severity = "warning";
  }

  // CASE 3: High clip count relative to video length
  if (clipCount > videoLengthSeconds / 30) {
    const estimatedRealistic = Math.max(1, Math.floor(videoLengthSeconds / 30));
    messages.push({
      type: "warning",
      title: "May not have enough unique highlights",
      description: `This video may only yield ${Math.max(1, estimatedRealistic - 2)}–${estimatedRealistic + 2} quality clips instead of ${clipCount}.`,
      action: "Velora will generate only high-quality clips, not duplicates.",
    });
    if (severity !== "error") severity = "warning";
  }

  // CASE 4: Total clip time exceeds video length
  if (totalRequestedSeconds > videoLengthSeconds && clipDuration <= videoLengthSeconds) {
    messages.push({
      type: "warning",
      title: "Total clip time exceeds video length",
      description: `You requested ${totalRequestedSeconds}s of clips from a ${videoLengthSeconds}s video. Generated clips will overlap.`,
      action: "Excessive overlap may reduce quality.",
    });
    if (severity !== "error") severity = "warning";
  }

  // CASE 5: Very short video
  if (videoLengthSeconds < 30) {
    messages.push({
      type: "info",
      title: "Very short video detected",
      description: `Videos under 30 seconds typically yield only 1 high-quality clip.`,
      action: "Consider using 15s clip duration with 1–2 clips.",
    });
    if (severity === "success") severity = "info";
  }

  // CASE 6: Very long video
  if (videoLengthSeconds > 7200) {
    messages.push({
      type: "info",
      title: "Long video - extended processing",
      description: `Videos over 2 hours take significantly longer to process.`,
      action: "Processing may take 10+ minutes.",
    });
    if (severity === "success") severity = "info";
  }

  // Smart recommendations based on video length
  let recommendations = null;
  let autoAdjust = null;

  if (videoLengthSeconds <= 60) {
    // Under 1 minute
    recommendations = {
      clipDuration: 15,
      clipCount: Math.max(1, Math.min(3, Math.floor(videoLengthSeconds / 15))),
      label: "Short video",
    };
  } else if (videoLengthSeconds <= 180) {
    // 1-3 minutes
    recommendations = {
      clipDuration: 20,
      clipCount: Math.max(3, Math.min(6, Math.floor(videoLengthSeconds / 30))),
      label: "Short video",
    };
  } else if (videoLengthSeconds <= 600) {
    // 3-10 minutes
    recommendations = {
      clipDuration: 30,
      clipCount: Math.max(6, Math.min(12, Math.floor(videoLengthSeconds / 45))),
      label: "Medium video",
    };
  } else if (videoLengthSeconds <= 1800) {
    // 10-30 minutes
    recommendations = {
      clipDuration: 45,
      clipCount: Math.max(12, Math.min(20, Math.floor(videoLengthSeconds / 60))),
      label: "Long video",
    };
  } else if (videoLengthSeconds <= 3600) {
    // 30-60 minutes
    recommendations = {
      clipDuration: 60,
      clipCount: Math.max(20, Math.min(30, Math.floor(videoLengthSeconds / 90))),
      label: "Very long video",
    };
  } else {
    // Over 1 hour
    recommendations = {
      clipDuration: 90,
      clipCount: Math.max(25, Math.min(40, Math.floor(videoLengthSeconds / 120))),
      label: "Extended video",
    };
  }

  // Auto-adjust: only suggest if current settings are suboptimal
  if (recommendations) {
    const currentDiff = Math.abs(clipDuration - recommendations.clipDuration) + Math.abs(clipCount - recommendations.clipCount);
    if (currentDiff > 2) {
      autoAdjust = {
        clipDuration: recommendations.clipDuration,
        clipCount: recommendations.clipCount,
        label: `Use Recommended (${recommendations.label})`,
      };
    }
  }

  const statusMap = { error: "impossible", warning: "warning", success: "ideal", info: "info" };
  const issues = messages.map((m) => `${m.title}. ${m.description}`);
  const recommendationsArray = recommendations ? [recommendations] : [];

  return {
    isValid: canContinue,
    status: statusMap[severity] || "ideal",
    issues,
    recommendations: recommendationsArray,
    autoAdjust,
    videoLength: videoLengthSeconds,
    requestedClipLength: clipDuration,
    totalRequestedSeconds,
    estimatedRealisticClips: Math.max(1, Math.floor(videoLengthSeconds / 30)),
  };
}

export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "Unknown";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}