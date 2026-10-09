"""Match test, Python side: saves raw landmarks + frame_features() output for a few frames,
so scripts/match_test.ts can check the TypeScript version builds the same numbers."""
import json
import random
from pathlib import Path

from features import frame_features

random.seed(0)
W, H = 1280, 720
cases = []
for n_hands in (0, 1, 2, 2):
    pose = [(random.uniform(.3, .7), random.uniform(.3, .9), random.uniform(-.5, .5)) for _ in range(33)]
    pose[11], pose[12] = (0.62, 0.55, 0.0), (0.38, 0.56, 0.0)  # shoulders
    hands = [[(random.random(), random.uniform(.3, 1), random.uniform(-.1, .1)) for _ in range(21)]
             for _ in range(n_hands)]
    cases.append({'pose': pose, 'hands': hands, 'W': W, 'H': H,
                  'features': frame_features(pose, hands, W, H).tolist()})
out = Path(__file__).resolve().parent.parent / 'scripts' / 'test_vectors.json'
json.dump(cases, open(out, 'w'))
print('wrote', out)
