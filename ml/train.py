"""Expresso trainer: learns YOUR signs from data/samples/*.json and exports ml/out/fsl.onnx + labels.json.

Same frame features (142 numbers, T = 32 frames) and the same small 1D-CNN as the Kamay prototype, so the
browser code in Expresso and Autonoma stays identical. Trained only on your own recordings.

Writes:
  out/fsl.onnx      ONNX model: input x [1, 32, 142] float32 -> logits [1, n_labels]
  out/labels.json   sorted sign names; index = logit index
  out/report.json   accuracy per sign on held-out recordings, confusions, counts
  out/selftest.json one held-out clip per sign with Python's answer, for the browser self-test

Run (from ml/):  venv/Scripts/python train.py    [--data DIR] [--epochs N]
"""
import argparse
import json
import random
import time
import warnings
from collections import Counter
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

from features import F, T, resample

parser = argparse.ArgumentParser()
parser.add_argument('--data', help='folder of <sign>.json recordings (default: ../data/samples)')
parser.add_argument('--epochs', type=int, default=80)
parser.add_argument('--out', help='where to write the model (default: ml/out)')
args = parser.parse_args()

HERE = Path(__file__).resolve().parent
DATA = Path(args.data) if args.data else HERE.parent / 'data' / 'samples'
OUT = Path(args.out) if args.out else HERE / 'out'
MIN_SAMPLES = 8    # a sign needs at least this many recordings to be trained
MIN_FRAMES = 15    # ~0.5 s; shorter recordings are cut-off signs
NONE_TARGET = 20   # recommended '_none' recordings (random movements), so they aren't forced into a sign
BATCH = 64
random.seed(0); np.random.seed(0); torch.manual_seed(0)
warnings.filterwarnings('ignore', category=DeprecationWarning)  # torch's note about its newer ONNX exporter
torch.set_num_threads(2)  # keeps the laptop responsive

samples = []
for path in sorted(DATA.glob('*.json')):
    for s in json.load(open(path, encoding='utf-8')):
        frames = np.asarray(s['frames'], dtype=np.float32)
        if frames.ndim == 2 and frames.shape[1] == F and len(frames) >= MIN_FRAMES:
            samples.append({'label': s['label'], 'person': s.get('person', ''), 'frames': frames})
counts = Counter(s['label'] for s in samples)
labels = sorted(label for label, n in counts.items() if n >= MIN_SAMPLES)
for label, n in sorted(counts.items()):
    if n < MIN_SAMPLES:
        print(f'{label}: only {n} recordings (need {MIN_SAMPLES}+), left out this time')
if '_none' not in labels:
    print(f'WARNING: no _none class. Record {NONE_TARGET}+ random movements, or every movement will be read as some sign.')
elif counts['_none'] < NONE_TARGET:
    print(f'note: only {counts["_none"]} _none recordings; {NONE_TARGET}+ makes accidental triggers rarer')
if len(labels) < 2:
    raise SystemExit(f'NOT READY: need at least 2 signs with {MIN_SAMPLES}+ recordings each (have {dict(counts)}).')

samples = [s for s in samples if s['label'] in labels]
for label in labels:  # every 5th recording of each sign is held out to measure accuracy honestly
    for k, s in enumerate(s for s in samples if s['label'] == label):
        s['split'] = 'test' if k % 5 == 4 else 'train'
idx = {label: i for i, label in enumerate(labels)}
train = [s for s in samples if s['split'] == 'train']
test = [s for s in samples if s['split'] == 'test']
print(f'{len(labels)} signs | {len(train)} train | {len(test)} held out | {", ".join(f"{l} {counts[l]}" for l in labels)}', flush=True)

XC = np.r_[0:14:2, 14:140:3]  # x columns
YC = np.r_[1:14:2, 15:140:3]  # y columns


def augment(frames):
    n = len(frames)  # random time crop, 85-100%
    k = max(4, int(n * random.uniform(0.85, 1.0)))
    start = random.randint(0, n - k)
    x = resample(frames[start:start + k]).copy()
    a = np.radians(random.uniform(-10, 10))  # rotate, scale, shift x/y
    c, s_ = np.cos(a), np.sin(a)
    px, py = x[:, XC].copy(), x[:, YC].copy()
    sc = random.uniform(0.9, 1.1)
    x[:, XC] = (c * px - s_ * py) * sc + random.uniform(-0.1, 0.1)
    x[:, YC] = (s_ * px + c * py) * sc + random.uniform(-0.1, 0.1)
    x[:, :140] += np.random.normal(0, 0.01, (T, 140))
    x[x[:, 140] == 0, 14:77] = 0  # missing hands stay exactly zero,
    x[x[:, 141] == 0, 77:140] = 0  # just like in the live app
    return x.astype(np.float32)


class Net(nn.Module):
    def __init__(self, c):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(F, 128, 5, padding=2), nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(0.2),
            nn.Conv1d(128, 128, 5, padding=2), nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(0.2),
            nn.Conv1d(128, 128, 3, padding=1), nn.BatchNorm1d(128), nn.ReLU())
        self.head = nn.Sequential(nn.Dropout(0.3), nn.Linear(256, c))

    def forward(self, x):  # x: (batch, 32, 142)
        h = self.conv(x.transpose(1, 2))
        return self.head(torch.cat([h.mean(-1), h.amax(-1)], 1))


OUT.mkdir(parents=True, exist_ok=True)
model = Net(len(labels))
opt = torch.optim.AdamW(model.parameters(), 1e-3, weight_decay=1e-4)
loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)
Xte = torch.tensor(np.stack([resample(s['frames']) for s in test]))
Yte = torch.tensor([idx[s['label']] for s in test])
best, started = -1.0, time.time()
for epoch in range(args.epochs):
    model.train(); random.shuffle(train)
    for b in range(0, len(train), BATCH):
        batch = train[b:b + BATCH]
        if len(batch) < 2:
            continue  # BatchNorm needs 2+ examples
        x = torch.tensor(np.stack([augment(s['frames']) for s in batch]))
        y = torch.tensor([idx[s['label']] for s in batch])
        opt.zero_grad(); loss_fn(model(x), y).backward(); opt.step()
    model.eval()
    with torch.no_grad():
        acc = (model(Xte).argmax(1) == Yte).float().mean().item()
    if acc >= best:
        best = acc; torch.save(model.state_dict(), OUT / 'best.pt')
    print(f'epoch {epoch + 1:3d}/{args.epochs}  held-out acc {acc:.3f}  best {best:.3f}', flush=True)

model.load_state_dict(torch.load(OUT / 'best.pt')); model.eval()
with torch.no_grad():
    probs = torch.softmax(model(Xte), 1)
pred = probs.argmax(1)

# Report: accuracy per sign on held-out recordings, and what gets confused with what.
per_sign, confusions = {}, Counter()
for label in labels:
    mask = Yte == idx[label]
    total = int(mask.sum())
    right = int((pred[mask] == idx[label]).sum()) if total else 0
    per_sign[label] = {'recordings': counts[label], 'held_out': total, 'correct': right, 'accuracy': right / total if total else None}
for t, p in zip(Yte.tolist(), pred.tolist()):
    if t != p:
        confusions[(labels[t], labels[p])] += 1
report = {
    'trained_at': time.strftime('%Y-%m-%d %H:%M:%S'), 'seconds': round(time.time() - started, 1), 'epochs': args.epochs,
    'accuracy': best, 'signs': per_sign, 'has_none': '_none' in labels,
    'confusions': [{'sign': a, 'read_as': b, 'times': n} for (a, b), n in confusions.most_common()],
}
for label, r in per_sign.items():
    print(f'  {label:<24} {r["correct"]}/{r["held_out"]} held-out correct ({r["recordings"]} recordings)')
for c in report['confusions']:
    print(f'  confused: {c["sign"]} -> {c["read_as"]} ({c["times"]}x)')

torch.onnx.export(model, torch.zeros(1, T, F), str(OUT / 'fsl.onnx'), input_names=['x'],
                  output_names=['logits'], opset_version=17, dynamo=False)
json.dump(labels, open(OUT / 'labels.json', 'w', encoding='utf-8'), ensure_ascii=False)
json.dump(report, open(OUT / 'report.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
# Self-test cases: one held-out clip per sign with Python's answer; the browser must give the same answer.
seen, cases = set(), []
for s, p in zip(test, pred.tolist()):
    if s['label'] not in seen:
        seen.add(s['label'])
        cases.append({'label': s['label'], 'python': labels[p], 'x': np.round(resample(s['frames']), 6).ravel().tolist()})
json.dump(cases, open(OUT / 'selftest.json', 'w', encoding='utf-8'), ensure_ascii=False)
print(f'best held-out accuracy {best:.1%}. Exported to {OUT}. Open Test to try it, then Export to Autonoma.')
