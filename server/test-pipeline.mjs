import { createProject, generateClips } from "./src/services/project.js";

const userId = "28a703c5-925d-4af4-8881-da4f9221bc79";
const youtubeUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

console.log("[Test] Creating project...");
const project = await createProject(userId, { title: "Popup Caption Test", source: "youtube", url: youtubeUrl });
console.log("[Test] Project created:", project.id);

console.log("[Test] Triggering pipeline with popup captions...");
try {
  const result = await generateClips(userId, project.id, { clipCount: 2, clipDuration: 30, captionStyle: "popup", captionPreset: "popup" });
  console.log("[Test] Pipeline result:", JSON.stringify(result));
} catch (err) {
  console.error("[Test] Pipeline error:", err.message);
}

console.log("[Test] Waiting 15 minutes...");
setTimeout(() => process.exit(0), 900000);
