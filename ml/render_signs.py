"""Draws every recorded sign as a stick figure, so other people can see how to do it.

For each sign it picks the take your trained model recognises most surely (the clearest example),
then writes two SVG files to docs/signs/, and the guide page docs/SIGNS.md:
  <SIGN>.svg        an animated loop of the sign
  <SIGN>-strip.svg  six moments of the sign, left to right, plus the path the wrists travel
Only tracked points are drawn (shoulders, arms, hands); no camera image is used.
The figure is mirrored, so it looks like the camera preview: like looking in a mirror.

Run from the Expresso folder:  ml\\venv\\Scripts\\python ml\\render_signs.py
"""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from features import F, T, resample  # noqa: E402

ROOT = HERE.parent
SAMPLES = ROOT / 'data' / 'samples'
OUT = ROOT / 'docs' / 'signs'
MODEL = HERE / 'out'

HAND_LINKS = [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8), (5, 9), (9, 10), (10, 11), (11, 12),
              (9, 13), (13, 14), (14, 15), (15, 16), (13, 17), (17, 18), (18, 19), (19, 20), (0, 17)]
# Pose points in feature order: nose, left shoulder, right shoulder, left elbow, right elbow, left wrist, right wrist.
ARM_LINKS = [(1, 2), (2, 4), (4, 6), (1, 3), (3, 5)]
# Hand slot A is the hand on the left of the camera image: your RIGHT hand (unless your hands cross).
HAND_COLORS = ('#4ade80', '#fbbf24')
BODY = '#8ab4f8'

# View: shoulder-centre origin, 1 unit = shoulder width, y grows downwards.
X0, X1, Y0, Y1 = -2.8, 2.8, -2.8, 2.0
SCALE = 36
W, H = round((X1 - X0) * SCALE), round((Y1 - Y0) * SCALE)


def px(x, y):
    """Feature coordinates → SVG pixels, mirrored like the camera preview."""
    return round((-x - X0) * SCALE, 1), round((y - Y0) * SCALE, 1)


def figure(f, dx=0, opacity=1.0):
    """SVG for one frame (142 numbers) at horizontal offset dx."""
    pose = [(f[i * 2], f[i * 2 + 1]) for i in range(7)]
    parts = []
    nx, ny = px(*pose[0])
    parts.append(f'<circle cx="{nx + dx}" cy="{ny}" r="{0.38 * SCALE:.1f}" fill="none" stroke="{BODY}" stroke-width="2.5"/>')
    sx, sy = px((pose[1][0] + pose[2][0]) / 2, (pose[1][1] + pose[2][1]) / 2)
    parts.append(f'<line x1="{sx + dx}" y1="{sy}" x2="{nx + dx}" y2="{ny + 0.38 * SCALE:.1f}" stroke="{BODY}" stroke-width="2.5"/>')
    for a, b in ARM_LINKS:
        (x1, y1), (x2, y2) = px(*pose[a]), px(*pose[b])
        # Arms are drawn faintly: when an arm leaves the camera's view, the tracker can only guess where it is.
        parts.append(f'<line x1="{x1 + dx}" y1="{y1}" x2="{x2 + dx}" y2="{y2}" stroke="{BODY}" stroke-width="4" stroke-linecap="round" opacity="{1 if a == 1 else 0.4}"/>')
    for slot in range(2):
        if f[140 + slot] <= 0:
            continue
        base = 14 + slot * 63
        pts = [px(f[base + k * 3], f[base + k * 3 + 1]) for k in range(21)]
        color = HAND_COLORS[slot]
        for a, b in HAND_LINKS:
            parts.append(f'<line x1="{pts[a][0] + dx}" y1="{pts[a][1]}" x2="{pts[b][0] + dx}" y2="{pts[b][1]}" stroke="{color}" stroke-width="2.6" stroke-linecap="round"/>')
        for x, y in pts[4::4]:  # fingertips
            parts.append(f'<circle cx="{x + dx}" cy="{y}" r="2.2" fill="{color}"/>')
    return f'<g opacity="{opacity}">{"".join(parts)}</g>'


def chest_line(dx=0):
    """Dashed line at the "hands up" height: below it, hands count as down."""
    y = round((1.5 - Y0) * SCALE, 1)
    return f'<line x1="{dx + 4}" y1="{y}" x2="{dx + W - 4}" y2="{y}" stroke="#ffffff22" stroke-dasharray="4 4"/>'


def trail(frames, dx=0):
    """Paths the two wrists travel during the sign, fading in from start to end."""
    parts = []
    for slot in range(2):
        pts = [px(f[14 + slot * 63], f[15 + slot * 63]) for f in frames if f[140 + slot] > 0]
        if len(pts) < 2:
            continue
        d = ' '.join(f'{"M" if i == 0 else "L"}{x + dx},{y}' for i, (x, y) in enumerate(pts))
        parts.append(f'<path d="{d}" fill="none" stroke="{HAND_COLORS[slot]}" stroke-width="2.5" stroke-linejoin="round" opacity="0.85"/>')
        (sx, sy), (ex, ey) = pts[0], pts[-1]
        parts.append(f'<circle cx="{sx + dx}" cy="{sy}" r="4" fill="none" stroke="{HAND_COLORS[slot]}" stroke-width="2"/>')
        parts.append(f'<circle cx="{ex + dx}" cy="{ey}" r="4.5" fill="{HAND_COLORS[slot]}"/>')
    return ''.join(parts)


def label(text, dx, y=H - 8):
    return f'<text x="{dx + W / 2}" y="{y}" fill="#c9d1e0" font-family="Segoe UI, Arial, sans-serif" font-size="13" text-anchor="middle">{text}</text>'


def svg(width, height, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">'
            f'<title>{title}</title><rect width="{width}" height="{height}" rx="10" fill="#0d1320"/>{body}</svg>')


def animated(sign, frames):
    """Loops the take: one group per frame, each shown for its slice of the loop."""
    seconds = max(1.6, len(frames) / 20)  # recordings run at about 20 frames per second
    frames = [frames[round(k * (len(frames) - 1) / 39)] for k in range(40)] if len(frames) > 40 else frames  # keeps the file small
    n = len(frames)
    groups = []
    for i, f in enumerate(frames):
        a, b = i / n, (i + 1) / n
        keys = '0;' + (f'{a:.4f};' if i else '') + f'{b:.4f};1'
        values = ('0;1;0;0' if i else '1;0;0')
        groups.append(f'<g opacity="{1 if i == 0 else 0}">{figure(f)}'
                      f'<animate attributeName="opacity" dur="{seconds:.2f}s" repeatCount="indefinite" calcMode="discrete" keyTimes="{keys}" values="{values}"/></g>')
    body = chest_line() + ''.join(groups) + label(sign.replace('_', ' '), 0, 16)
    return svg(W, H, body, f'{sign}: animated sign')


def strip(sign, frames):
    picks = [frames[round(k * (len(frames) - 1) / 5)] for k in range(6)]
    gap = 6
    body = []
    for k, f in enumerate(picks):
        dx = k * (W + gap)
        body.append(f'<rect x="{dx}" width="{W}" height="{H}" rx="10" fill="#111a2b"/>' + chest_line(dx) + figure(f, dx) + label(f'{k + 1}', dx))
    dx = 6 * (W + gap)
    body.append(f'<rect x="{dx}" width="{W}" height="{H}" rx="10" fill="#111a2b"/>' + chest_line(dx) + figure(frames[0], dx, 0.18) + trail(frames, dx) + label('wrist path: ○ start → ● end', dx))
    width = 7 * W + 6 * gap
    return svg(width, H, ''.join(body), f'{sign}: six moments of the sign and the path of the wrists')


def tidy(frames):
    """Share of frames that draw cleanly: shoulders level and every tracked hand point inside the picture."""
    good = 0
    for f in frames:
        level = abs(f[3] - f[5]) < 0.35  # left and right shoulder at about the same height
        inside = all(X0 < f[base + k * 3] < X1 and Y0 < f[base + k * 3 + 1] < Y1
                     for slot, base in ((0, 14), (1, 77)) if f[140 + slot] > 0 for k in range(21))
        good += level and inside
    return good / len(frames)


def scorer():
    """Returns a function giving the trained model's confidence that a take is its sign, or None without a model."""
    if not (MODEL / 'best.pt').exists():
        return None
    import torch
    from torch import nn

    labels = json.loads((MODEL / 'labels.json').read_text())

    class Net(nn.Module):  # same as ml/train.py
        def __init__(self, c):
            super().__init__()
            self.conv = nn.Sequential(
                nn.Conv1d(F, 128, 5, padding=2), nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(0.2),
                nn.Conv1d(128, 128, 5, padding=2), nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(0.2),
                nn.Conv1d(128, 128, 3, padding=1), nn.BatchNorm1d(128), nn.ReLU())
            self.head = nn.Sequential(nn.Dropout(0.3), nn.Linear(256, c))

        def forward(self, x):
            h = self.conv(x.transpose(1, 2))
            return self.head(torch.cat([h.mean(-1), h.amax(-1)], 1))

    model = Net(len(labels))
    model.load_state_dict(torch.load(MODEL / 'best.pt'))
    model.eval()

    def score(sign, frames):
        with torch.no_grad():
            p = torch.softmax(model(torch.tensor(resample(frames))[None]), 1)[0]
        return float(p[labels.index(sign)]) if sign in labels else 0.0
    return score


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    score = scorer()
    summary = []
    for file in sorted(SAMPLES.glob('*.json')):
        takes = json.loads(file.read_text())
        if not takes or takes[0]['label'] == '_none':
            continue
        sign = takes[0]['label']
        if score:
            # Skip very short takes (cut-off signs look abrupt), then take the one the model is surest about.
            median = sorted(len(t['frames']) for t in takes)[len(takes) // 2]
            # Prefer takes that draw cleanly (you fully in view), then the one the model is surest about.
            usable = [t for t in takes if len(t['frames']) >= 0.6 * median] or takes
            clean = [t for t in usable if tidy(t['frames']) >= 0.9] or sorted(usable, key=lambda t: tidy(t['frames']), reverse=True)[:5]
            ranked = sorted(clean, key=lambda t: score(sign, t['frames']), reverse=True)
            best, sure = ranked[0], score(sign, ranked[0]['frames'])
        else:  # no model yet: the take of median length
            best, sure = sorted(takes, key=lambda t: len(t['frames']))[len(takes) // 2], None
        frames = [np.asarray(f, dtype=np.float32) for f in best['frames']]
        # Leave out the odd frames where tracking glitched (you partly out of view), as long as most of the sign remains.
        clean_frames = [f for f in frames if tidy([f]) == 1]
        if len(clean_frames) >= max(10, 0.5 * len(frames)):
            frames = clean_frames
        name = sign.replace(' ', '_')
        (OUT / f'{name}.svg').write_text(animated(sign, frames), encoding='utf-8')
        (OUT / f'{name}-strip.svg').write_text(strip(sign, frames), encoding='utf-8')
        hands = [sum(1 for f in frames if f[140 + s] > 0) / len(frames) for s in range(2)]
        used = ' and '.join(n for n, share in zip(('right', 'left'), hands) if share > 0.3) or 'one'
        lengths = sorted(len(t['frames']) for t in takes)
        summary.append({'sign': sign, 'file': name, 'takes': len(takes), 'frames': len(frames),
                        'median_frames': lengths[len(lengths) // 2], 'hands': used, 'confidence': sure})
        print(f'{sign:<24} take of {len(frames)} frames, hands: {used}' + (f', model {sure:.0%} sure' if sure is not None else ''))
    (OUT / 'signs.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    (ROOT / 'docs' / 'SIGNS.md').write_text(guide(summary), encoding='utf-8')


# What Autonoma does with each sign (a sign's name is read like a spoken command).
DOES = {
    'FILL THIS PAGE': 'Fills the whole page.',
    'FILL THIS': 'Fills the question you last clicked, or the one in the middle of the screen.',
    'FILL ALL PAGES': 'Fills the form and clicks Next through every page.',
    'FILL THIS FULL NAME': 'Fills only the full-name question.',
    'FILL THIS EMAIL': 'Fills only the email question.',
    'FILL THIS PHONE NUMBER': 'Fills only the phone-number question.',
    'WHAT IS MISSING': 'Says (and shows) which questions are still empty.',
    'NEXT': 'Clicks Next.',
    'SUBMIT': 'Asks first: it submits only after a YES sign within 15 seconds.',
    'YES': 'Confirms a SUBMIT.',
    'NO': 'Cancels a SUBMIT.',
    'STOP': 'Stops a fill. Always goes through, even while another command runs.',
}
ORDER = list(DOES)


def guide(summary):
    rows = sorted(summary, key=lambda s: ORDER.index(s['sign']) if s['sign'] in ORDER else len(ORDER))
    def does(sign):
        return DOES.get(sign, f'Read as the spoken command "{sign.lower()}".')
    toc = '\n'.join(f"| [{s['sign']}](#{s['sign'].lower().replace(' ', '-')}) | {does(s['sign'])} |" for s in rows)
    parts = []
    for s in rows:
        sure = f" The trained model recognises this take {s['confidence']:.0%} surely." if s['confidence'] is not None else ''
        parts.append(f"""### {s['sign']}

**Autonoma:** {does(s['sign'])}

<img src="signs/{s['file']}.svg" width="240" alt="{s['sign']}, animated"/>

![{s['sign']}: six moments of the sign and the path of the wrists](signs/{s['file']}-strip.svg)

Hands: {s['hands']} · {s['takes']} takes recorded · a typical take is about {s['median_frames']} frames (≈ {s['median_frames'] / 20:.1f} s).{sure}
""")
    return f"""# Sign guide: the {len(rows)} signs we trained

These are the signs recorded in Expresso for Autonoma's commands, one section per sign. Each sign is drawn from our own recordings, from the take the trained model recognises most surely. Only the tracked points are drawn (no video).

**How to read the pictures**
- The figure is **mirrored, like the camera preview**: move the way you see it.
- **Green = your right hand, amber = your left hand.** Arms are faint (the camera often can't see your elbows).
- The **dashed line** is chest height. Hands below it count as *down*, so a sign happens above it.
- The animation loops the whole sign. The strip shows six moments, left to right. The last panel shows the path each wrist travels: ○ start, ● end.

**How to sign for Autonoma**
1. Sit so your head, shoulders and both hands are in view, in good light.
2. Start with your hands **down**.
3. Raise them, make the sign, then **drop your hands**. Dropping your hands ends the sign; holding still for 0.7 s also works.
4. One sign at a time. The orb shows *Reading your sign…*, then *Signed "…"*, or *Not sure… sign it again*.

**Trying it yourself (judges)**
- Our trained model is **not** in the repository. It's learnt from one person's body and wouldn't read you reliably, and it stays private.
- Copy these movements in **Expresso**:
  1. **Record:** 15 takes of each sign, plus 25 random movements as `_none`.
  2. **Train**, then **Test** it live.
  3. **Export** to Autonoma.
- In **[Autonoma](https://github.com/Jullemyth122/Autonoma)**:
  1. Reload the extension.
  2. Workspace → **Signs** → **Allow camera** and **Run self-test**.
  3. Switch on **Sign mode** in the side panel.
- You can also make up your own signs: any name that reads like a command works (e.g. `FILL THIS BIRTHDAY`).

| Sign | What Autonoma does |
| --- | --- |
{toc}

---

{chr(10).join(parts)}
---

*Made by `ml/render_signs.py` from the recordings in `data/samples/` (re-run it after recording or training again).*
"""


if __name__ == '__main__':
    main()
