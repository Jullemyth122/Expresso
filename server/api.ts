// Expresso's local API, served by the Vite dev server (no separate backend to start).
// Saves your sign recordings, runs training, serves the trained model, and exports it to Autonoma.
// Only reachable from this computer: requests must come to localhost and writes need the x-expresso header,
// which a web page on another site can't add without CORS approval.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATA = join(ROOT, 'data');
const SAMPLES = join(DATA, 'samples');
const SIGNS_FILE = join(DATA, 'signs.json');
const ML = join(ROOT, 'ml');
const OUT = join(ML, 'out');
const AUTONOMA = resolve(ROOT, '..', 'Autonoma');
const AUTONOMA_SIGN = join(AUTONOMA, 'public', 'sign');
const PYTHON = process.platform === 'win32' ? join(ML, 'venv', 'Scripts', 'python.exe') : join(ML, 'venv', 'bin', 'python');
const F = 142, MIN_FRAMES = 15, MAX_FRAMES = 400;

/** Starter commands, written the way Autonoma's command parser reads them. '_none' = random movements. */
export const DEFAULT_SIGNS = [
  'FILL THIS PAGE', 'FILL THIS', 'FILL ALL PAGES',
  'FILL THIS FULL NAME', 'FILL THIS EMAIL', 'FILL THIS PHONE NUMBER',
  'WHAT IS MISSING', 'NEXT', 'SUBMIT', 'STOP', 'YES', 'NO', '_none',
];
const MODEL_FILES: Record<string, string> = { 'fsl.onnx': 'application/octet-stream', 'labels.json': 'application/json', 'report.json': 'application/json', 'selftest.json': 'application/json' };

interface Sample { label: string; person: string; at: string; frames: number[][] }
interface Job { running: boolean; code: number | null; log: string; startedAt?: string }
const train: Job = { running: false, code: null, log: '' };
const exporting: Job = { running: false, code: null, log: '' };

mkdirSync(SAMPLES, { recursive: true });
const normalize = (name: string) => name === '_none' ? '_none' : name.toUpperCase().replace(/[^A-Z0-9' ]/g, '').replace(/\s+/g, ' ').trim();
const fileFor = (label: string) => join(SAMPLES, `${label.replace(/[^A-Za-z0-9_ ]/g, '').trim().replace(/\s+/g, '_')}.json`);
const readJson = <T>(path: string, fallback: T): T => { try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return fallback; } };
const readSigns = () => readJson<string[]>(SIGNS_FILE, DEFAULT_SIGNS);
const readSamples = (label: string) => readJson<Sample[]>(fileFor(label), []);

function send(res: ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((ok, fail) => {
    let text = '';
    req.on('data', chunk => { text += chunk; if (text.length > 8_000_000) { fail(new Error('Request too large')); req.destroy(); } });
    req.on('end', () => { try { ok(text ? JSON.parse(text) : {}); } catch (error) { fail(error); } });
  });
}
function run(job: Job, command: string, args: string[], cwd: string, shell = false) {
  Object.assign(job, { running: true, code: null, log: '', startedAt: new Date().toISOString() });
  const child = spawn(command, args, { cwd, shell, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1', OPENBLAS_NUM_THREADS: '1' } });
  const add = (chunk: Buffer) => { job.log = (job.log + chunk.toString()).slice(-200_000); };
  child.stdout.on('data', add);
  child.stderr.on('data', add);
  child.on('error', error => { job.log += `\n${error.message}`; job.running = false; job.code = -1; });
  child.on('close', code => { job.running = false; job.code = code; });
}
function counts() {
  const all: Record<string, number> = {};
  for (const sign of readSigns()) all[sign] = readSamples(sign).length;
  for (const file of readdirSync(SAMPLES).filter(name => name.endsWith('.json'))) {
    const list = readJson<Sample[]>(join(SAMPLES, file), []);
    if (list[0] && !(list[0].label in all)) all[list[0].label] = list.length; // recordings of a sign no longer in the list
  }
  return all;
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host ?? '')) return send(res, 403, { error: 'Expresso only answers on this computer.' });

  // The trained model, read-only (Expresso's Test page and Autonoma's self-test read these).
  const model = path.match(/^\/api\/model\/([\w.]+)$/);
  if (req.method === 'GET' && model && MODEL_FILES[model[1]]) {
    const file = join(OUT, model[1]);
    if (!existsSync(file)) return send(res, 404, { error: 'No trained model yet. Record your signs, then press Train.' });
    res.setHeader('Content-Type', MODEL_FILES[model[1]]);
    res.setHeader('Cache-Control', 'no-store');
    return res.end(readFileSync(file));
  }
  if (req.method !== 'GET' && req.headers['x-expresso'] !== '1') return send(res, 403, { error: 'Missing x-expresso header.' });

  if (path === '/api/signs' && req.method === 'GET') return send(res, 200, readSigns());
  if (path === '/api/signs' && req.method === 'POST') {
    const name = normalize(String((await body(req)).name ?? ''));
    if (!name || name.length > 48) return send(res, 400, { error: 'Use 1–48 letters, numbers or spaces.' });
    const signs = readSigns();
    if (!signs.includes(name)) { signs.splice(Math.max(0, signs.indexOf('_none')), 0, name); writeFileSync(SIGNS_FILE, JSON.stringify(signs, null, 2)); }
    return send(res, 200, signs);
  }
  if (path === '/api/signs/remove' && req.method === 'POST') {
    const name = String((await body(req)).name ?? '');
    const signs = readSigns().filter(sign => sign !== name || sign === '_none');
    writeFileSync(SIGNS_FILE, JSON.stringify(signs, null, 2));
    return send(res, 200, signs);
  }

  if (path === '/api/samples' && req.method === 'GET') return send(res, 200, counts());
  if (path === '/api/samples' && req.method === 'POST') {
    const input = await body(req);
    const label = normalize(String(input.label ?? '')), frames = input.frames as number[][];
    if (!label || !readSigns().includes(label)) return send(res, 400, { error: `Unknown sign "${label}".` });
    if (!Array.isArray(frames) || frames.length < MIN_FRAMES || frames.length > MAX_FRAMES || frames.some(frame => !Array.isArray(frame) || frame.length !== F)) {
      return send(res, 400, { error: `A recording needs ${MIN_FRAMES}–${MAX_FRAMES} frames of ${F} numbers.` });
    }
    const list = readSamples(label);
    list.push({ label, person: String(input.person ?? '').slice(0, 40), at: new Date().toISOString(), frames: frames.map(frame => frame.map(v => Math.round(v * 1e5) / 1e5)) });
    writeFileSync(fileFor(label), JSON.stringify(list));
    return send(res, 200, { label, count: list.length });
  }
  if ((path === '/api/samples/undo' || path === '/api/samples/clear') && req.method === 'POST') {
    const label = normalize(String((await body(req)).label ?? ''));
    const list = path.endsWith('undo') ? readSamples(label).slice(0, -1) : [];
    writeFileSync(fileFor(label), JSON.stringify(list));
    return send(res, 200, { label, count: list.length });
  }

  if (path === '/api/train' && req.method === 'GET') return send(res, 200, { ...train, report: readJson(join(OUT, 'report.json'), null) });
  if (path === '/api/train' && req.method === 'POST') {
    if (train.running) return send(res, 409, { error: 'Training is already running.' });
    if (!existsSync(PYTHON)) return send(res, 400, { error: 'The Python environment is not set up yet. Run "npm run setup:ml" once in the Expresso folder.' });
    run(train, PYTHON, ['train.py'], ML);
    return send(res, 200, train);
  }

  if (path === '/api/export' && req.method === 'GET') return send(res, 200, { ...exporting, target: AUTONOMA_SIGN, autonoma: existsSync(AUTONOMA) });
  if (path === '/api/export' && req.method === 'POST') {
    if (!existsSync(join(OUT, 'fsl.onnx')) || !existsSync(join(OUT, 'labels.json'))) return send(res, 400, { error: 'Train a model first.' });
    if (!existsSync(AUTONOMA)) return send(res, 400, { error: `Autonoma was not found at ${AUTONOMA}.` });
    mkdirSync(AUTONOMA_SIGN, { recursive: true });
    const copied = Object.keys(MODEL_FILES).filter(name => existsSync(join(OUT, name)));
    for (const name of copied) copyFileSync(join(OUT, name), join(AUTONOMA_SIGN, name));
    if ((await body(req)).build) run(exporting, 'npm', ['run', 'build'], AUTONOMA, true);
    else Object.assign(exporting, { running: false, code: 0, log: `Copied ${copied.join(', ')} to ${AUTONOMA_SIGN}. Run "npm run build" in Autonoma, then reload the extension.` });
    return send(res, 200, { copied, target: AUTONOMA_SIGN, ...exporting });
  }
  return send(res, 404, { error: 'Not found' });
}

export function expressoApi(): Plugin {
  return {
    name: 'expresso-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        handle(req, res).catch(error => send(res, 500, { error: error instanceof Error ? error.message : String(error) }));
      });
    },
  };
}
