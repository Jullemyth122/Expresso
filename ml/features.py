"""Feature spec: one frame -> 142 numbers. Must match web/src/lib/features.ts exactly."""
import numpy as np

T = 32
POSE_IDS = [0, 11, 12, 13, 14, 15, 16]
F = len(POSE_IDS) * 2 + 2 * 21 * 3 + 2  # 142


def frame_features(pose, hands, W, H):
    """pose: 33 (x, y, z) tuples or None. hands: list of 21-point lists."""
    if pose is None:
        return None
    lsx, lsy = pose[11][0] * W, pose[11][1] * H
    rsx, rsy = pose[12][0] * W, pose[12][1] * H
    cx, cy = (lsx + rsx) / 2, (lsy + rsy) / 2
    s = ((lsx - rsx) ** 2 + (lsy - rsy) ** 2) ** 0.5
    if s < 1e-3:
        return None
    out = []
    for i in POSE_IDS:
        out += [(pose[i][0] * W - cx) / s, (pose[i][1] * H - cy) / s]
    hs = sorted(hands[:2], key=lambda h: h[0][0])
    slots = [None, None]
    if len(hs) == 2:
        slots = hs
    elif len(hs) == 1:
        slots[0 if hs[0][0][0] * W < cx else 1] = hs[0]
    flags = []
    for h in slots:
        if h is None:
            out += [0.0] * 63
            flags.append(0.0)
        else:
            for x, y, z in h:
                out += [(x * W - cx) / s, (y * H - cy) / s, (z * W) / s]
            flags.append(1.0)
    return np.asarray(out + flags, dtype=np.float32)


def resample(seq, t=T):
    seq = np.asarray(seq, dtype=np.float32)
    n = len(seq)
    if n == 1:
        return np.repeat(seq, t, axis=0)
    src = np.linspace(0, n - 1, t)
    lo = np.floor(src).astype(int)
    hi = np.minimum(lo + 1, n - 1)
    w = (src - lo)[:, None]
    return (seq[lo] * (1 - w) + seq[hi] * w).astype(np.float32)


def is_active(f):
    # Slot A wrist y is index 15, slot B wrist y is index 78; flags at 140, 141
    return bool((f[140] > 0 and f[15] < 1.5) or (f[141] > 0 and f[78] < 1.5))
