const w = require('whisper-cpp-node');
const p = require('path');
const m = p.join(process.cwd(), 'models', 'ggml-base.en.bin');
console.log('Loading model...');
const t = Date.now();
try {
  const ctx = w.createWhisperContext({ model: m, no_prints: true, use_gpu: false });
  console.log('Context created in', Date.now()-t, 'ms');
  ctx.free();
  console.log('Context freed');
} catch(e) {
  console.error('Error:', e.message);
  console.error(e.stack);
}
process.exit(0);
