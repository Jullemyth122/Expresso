import * as ort from 'onnxruntime-web/wasm';
import { F, T } from './features';

// Vite won't let JS import files from public/, so the runtime loads from node_modules (works offline too)
ort.env.wasm.numThreads = 1; // multi-threading needs special server headers; the model is tiny anyway

let session: ort.InferenceSession | null = null;
let labels: string[] = [];

// Expresso serves the latest trained model from ml/out through its local API.
export async function loadClassifier(base = '/api/model') {
  const r = await fetch(`${base}/labels.json`, { cache: 'no-store' });
  // Vite answers a missing file with index.html, so check it's really JSON
  if (!r.ok || !r.headers.get('content-type')?.includes('json')) {
    throw new Error('No trained model yet. Record your signs, then train (Train tab).');
  }
  labels = await r.json();
  session = await ort.InferenceSession.create(`${base}/fsl.onnx`, { executionProviders: ['wasm'] });
  return labels;
}

export async function classify(seq: Float32Array) {
  if (!session) throw new Error('classifier not loaded');
  const out = await session.run({ x: new ort.Tensor('float32', seq, [1, T, F]) });
  const z = out.logits.data as Float32Array;
  const m = Math.max(...z);
  const e = Array.from(z, (v) => Math.exp(v - m));
  const sum = e.reduce((a, b) => a + b, 0);
  const ranked = e.map((v, i) => ({ label: labels[i], prob: v / sum })).sort((a, b) => b.prob - a.prob);
  return { label: ranked[0].label, prob: ranked[0].prob, top3: ranked.slice(0, 3) };
}
