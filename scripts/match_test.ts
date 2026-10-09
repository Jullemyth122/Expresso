// Match test, TypeScript side: run ml/make_test_vectors.py first, then `npm run match-test`.
import { readFileSync } from 'node:fs';
import { frameFeatures, type P } from '../src/lib/features.ts';

const toP = (a: number[]): P => ({ x: a[0], y: a[1], z: a[2] });
const cases = JSON.parse(readFileSync(new URL('./test_vectors.json', import.meta.url), 'utf8'));
let worst = 0;
for (const c of cases) {
  const f = frameFeatures(c.pose.map(toP), c.hands.map((h: number[][]) => h.map(toP)), c.W, c.H)!;
  for (let i = 0; i < f.length; i++) worst = Math.max(worst, Math.abs(f[i] - c.features[i]));
  if (f.length !== c.features.length) throw new Error(`length ${f.length} vs ${c.features.length}`);
}
console.log(`${cases.length} frames, max difference ${worst.toExponential(2)}`);
if (worst > 1e-4) { console.log('MISMATCH: Python and TypeScript features differ'); process.exit(1); }
console.log('MATCH: Python and TypeScript build the same numbers');
