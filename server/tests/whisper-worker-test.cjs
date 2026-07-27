const { Worker } = require('worker_threads');
const w = new Worker(`
  const w = require('whisper-cpp-node');
  const p = require('path');
  const m = p.join(process.cwd(), 'models', 'ggml-base.en.bin');
  const t = Date.now();
  const { parentPort } = require('worker_threads');
  parentPort.postMessage('creating context...');
  const ctx = w.createWhisperContext({ model: m, use_gpu: false, no_prints: true });
  parentPort.postMessage('done in ' + (Date.now() - t) + ' ms');
  ctx.free();
  parentPort.postMessage('exit');
`, { eval: true });
w.on('message', m => console.log('msg:', m));
w.on('error', e => console.error('err:', e.message));
w.on('exit', c => { console.log('exit:', c); process.exit(0); });
setTimeout(() => { console.log('90s timeout — killing worker'); w.terminate(); }, 90000);
