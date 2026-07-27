import { generatePremiumCaptionFile } from "./src/services/premium-captions.js";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import config from "./src/config/env.js";

const testSegments = [
  {
    text: "This is a test caption",
    start: 0,
    end: 3,
    words: [
      { word: "This", start: 0, end: 0.5 },
      { word: "is", start: 0.5, end: 0.8 },
      { word: "a", start: 0.8, end: 1.0 },
      { word: "test", start: 1.0, end: 1.8 },
      { word: "caption", start: 1.8, end: 3.0 },
    ],
  },
];

const testConfig = {
  fontSize: 120,
  fontName: "Poppins",
  fontWeight: 800,
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
  outlineWidth: 5,
  shadowColor: "#000000",
  shadowDepth: 6,
  highlightScale: 1.2,
  highlightGlow: true,
  highlightGlowColor: "#00D4FF",
  highlightGlowIntensity: 8,
  animIn: 120,
  animOut: 80,
};

const assPath = path.join(process.cwd(), "test_popup.ass");
const outputPath = path.join(process.cwd(), "test_popup_frame.png");

try {
  await generatePremiumCaptionFile(
    testSegments,
    {},
    assPath,
    "popup",
    1080,
    1920,
    { captionConfig: testConfig }
  );

  console.log("=== ASS FILE CONTENT ===");
  const assContent = fs.readFileSync(assPath, "utf-8");
  console.log(assContent);
  console.log("=== END ASS FILE ===\n");

  // Render a frame at 1.5 seconds (middle of "test" word)
  const assRel = "test_popup.ass";
  const fontsRel = "fonts";

  const ffmpegPath = config.video.ffmpegPath;
  console.log(`FFmpeg: ${ffmpegPath}`);
  console.log(`Fonts: ${fontsRel}`);
  console.log(`ASS: ${assRel}`);

  // Create a black 1080x1920 background, burn ASS at t=1.5s, output single frame
  const result = await new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      "-y",
      "-f", "lavfi", "-i", "color=c=black:s=1080x1920:d=3:r=30",
      "-vf", `ass=${assRel}:fontsdir=${fontsRel}`,
      "-ss", "1.5",
      "-frames:v", "1",
      outputPath,
    ], { stdio: ["ignore", "pipe", "pipe"], cwd: process.cwd() });

    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-500)}`));
    });
  });

  console.log(`\nRendered frame saved to: ${outputPath}`);
  console.log("Compare this with the CSS preview to see the difference.");
} catch (err) {
  console.error("Error:", err.message);
} finally {
  if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
}
