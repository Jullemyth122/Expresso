# Time log: Expresso

Expresso is the sign-training companion to **[Autonoma](https://github.com/Jullemyth122/Autonoma)**. It was built on the night of 9–10 October 2026 (local time, UTC+8), after Autonoma's voice features were done.

## What happened, in order

- **About 11:00–11:23 PM:** plan with Claude Code. The idea: train sign language in a separate app so the Chrome extension stays light, and only *recognise* signs inside Autonoma. The team's earlier FSL project **Kamay** (`C:\Full Stack Production\FSL\practice`) was read for reference only. It wasn't changed.
- **11:23 PM:** the sign pipeline was copied from Kamay:
  - feature code (`src/lib/features.ts`, `ml/features.py`) and sign cutting (`segmenter.ts`);
  - MediaPipe setup (`landmarks.ts`), the classifier wrapper and the camera hook;
  - MediaPipe's tracking models.
- **11:25–11:36 PM:** Claude Code built the app:
  - local API in the Vite dev server (`server/api.ts`): recordings, training, model serving, export to Autonoma, localhost-only plus a write header;
  - trainer `ml/train.py` with held-out accuracy, mix-ups and a self-test file;
  - Python setup script; Record / Train / Test / Export pages; first README.
- **11:31–11:37 PM:** checks.
  - Python and TypeScript features match exactly.
  - Training on synthetic recordings works.
  - The ONNX model gives the same answers as PyTorch (5/5).
  - The browser test passed, with an FSL-105 clip as a fake camera.
  - All test data was deleted afterwards.
- **11:39 PM:** MediaPipe pinned to 1.1.0, and its wasm files copied from that exact package. Kamay's were from 1.0.1.
- **11:38 PM–12:00 AM:** Autonoma got **Sign mode** (recognition only); see Autonoma's TIMELOG.
- **12:30–1:09 AM:** the developer recorded **12 signs × 15 takes** (STOP has 22), 187 recordings in all, and trained the first real model at 1:09 AM: 100% on held-out takes. It was then exported to Autonoma; its self-test there matched the trainer 12/12.
- **1:31–1:48 AM:** **ChatGPT Codex** redesigned the UI:
  - new app shell (`App.tsx`: sidebar workflow, page titles, quick guide);
  - theme picker and themes; icon set; Inter font; favicon;
  - restyled Record, Train, Test and Export pages, camera view and styles;
  - README wording; production build check.
- **2:05 AM:** Claude Code made Expresso its own git repository, linked to Autonoma, and wrote this time log.

## Files

Created and last-changed times come from the file system. "Kamay" means copied from the team's earlier project, then adapted.

| File | Created | Last changed | By | What it is |
| --- | --- | --- | --- | --- |
| `src/lib/features.ts` | 11:23 PM | — | Kamay → Claude Code | One camera frame → 142 numbers (body, both hands); must match `ml/features.py` |
| `src/lib/segmenter.ts` | 11:23 PM | — | Kamay → Claude Code | Cuts the frame stream into signs (hands down or hold still) |
| `src/lib/landmarks.ts` | 11:23 PM | — | Kamay → Claude Code | Starts MediaPipe hand + pose tracking (GPU, CPU fallback) |
| `src/lib/classifier.ts` | 11:23 PM | 11:26 PM | Kamay → Claude Code | Runs the trained ONNX model; now loads it from Expresso's API |
| `src/lib/useTracker.ts` | 11:23 PM | 11:26 PM | Kamay → Claude Code | Webcam, tracking loop and skeleton drawing |
| `ml/features.py` | 11:23 PM | — | Kamay → Claude Code | Python copy of the features, used for training |
| `public/mediapipe/*.task` | 11:23 PM | — | Google MediaPipe (via Kamay) | Hand and pose tracking models (Apache 2.0) |
| `public/mediapipe/wasm/*` | 11:23 PM | 11:39 PM | Google MediaPipe | Tracking runtime, synced to the 1.1.0 package |
| `vite.config.ts`, `tsconfig.json` | 11:25 PM | — | Claude Code | Build and TypeScript settings |
| `scripts/setup-ml.mjs` | 11:25 PM | — | Claude Code | Makes `ml/venv` with CPU PyTorch |
| `ml/requirements.txt` | 11:25 PM | — | Claude Code | torch 2.14.1+cpu, numpy, onnx, onnxscript |
| `ml/make_test_vectors.py`, `scripts/match_test.ts` | 11:25 PM | — | Kamay → Claude Code | Check that Python and TypeScript features match |
| `src/api.ts` | 11:26 PM | — | Claude Code | Calls the local API (adds the `x-expresso` header) |
| `src/components/CameraView.tsx` | 11:26 PM | 1:32 AM | Claude Code; restyled by Codex | Camera with the tracked skeleton |
| `index.html` | 11:26 PM | 1:42 AM | Claude Code; Codex | Page shell |
| `src/pages/Record.tsx` | 11:27 PM | 1:46 AM | Claude Code; redesigned by Codex | Record tab: sign library, takes, add / remove signs |
| `src/pages/Train.tsx`, `Test.tsx`, `Export.tsx` | 11:29 PM | 1:43 AM | Claude Code; redesigned by Codex | Train, Test and Export tabs |
| `src/main.tsx` | 11:30 PM | 1:47 AM | Claude Code; Codex | Starts the app |
| `src/styles.css` | 11:30 PM | 1:46 AM | Claude Code; redesigned by Codex | All styles |
| `.gitignore` | 11:30 PM | 2:05 AM | Claude Code | Keeps recordings, the trained model and the Python env out of git |
| `server/api.ts` | 11:31 PM | — | Claude Code | Local API: signs, recordings, training, model, export |
| `ml/train.py` | 11:34 PM | — | Claude Code | Trainer: 1D CNN, held-out report, ONNX + self-test export |
| `README.md` | 11:36 PM | 2:05 AM | Claude Code; Codex | Setup, workflow, link to Autonoma |
| `package.json`, `package-lock.json` | 11:26 PM | 11:39 PM | Claude Code | Scripts and exact versions |
| `src/App.tsx` | 1:47 AM | — | ChatGPT Codex | App shell: sidebar workflow, titles, quick guide |
| `src/theme.ts`, `src/components/ThemePicker.tsx` | 1:31 AM | — | ChatGPT Codex | Colour themes |
| `src/components/Icon.tsx` | 1:31 AM | 1:47 AM | ChatGPT Codex | Icon set |
| `public/fonts/InterVariable.woff2` + licence | 1:41 AM | — | Inter (SIL OFL 1.1), added by Codex | Font |
| `public/favicon.svg` | 1:42 AM | — | ChatGPT Codex | Tab icon |
| `docs/screenshots/expresso-record.jpg` | 1:48 AM | — | ChatGPT Codex (verification screenshot) | README screenshot, camera off |
| `TIMELOG.md` | 2:05 AM | — | Claude Code | This file |

**Not in git, on purpose:**
- `data/samples/` holds your recordings (body and hand movements, stored as numbers, not video).
- `ml/out/` holds your trained model.
- `ml/venv/` holds Python and PyTorch, about 1 GB.
