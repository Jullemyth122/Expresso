import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawingUtils, HandLandmarker } from '@mediapipe/tasks-vision';
import { createLandmarkers } from './landmarks';
import { frameFeatures, isActive } from './features';

type OnFrame = (f: Float32Array | null, t: number) => void;
const POSE_LINKS: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16]];

function savedCamera() { try { return localStorage.getItem('expresso.camera') ?? ''; } catch { return ''; } }

// Webcam -> MediaPipe -> 142 numbers per frame -> onFrame. Also draws the points.
export function useTracker(onFrame: OnFrame) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cb = useRef(onFrame);
  cb.current = onFrame;
  const [status, setStatus] = useState<'idle' | 'loading' | 'running' | 'error'>('idle');
  const [error, setError] = useState('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState(savedCamera);
  // seen = % of frames in the last half second where at least one hand was found
  const [live, setLive] = useState({ hands: 0, active: false, fps: 0, seen: 0 });
  const stop = useRef<() => void>(() => {});

  const start = useCallback(async (deviceId = cameraId) => {
    stop.current();
    setStatus('loading'); setError('');
    try {
      const { hand, pose } = await createLandmarkers();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId }, width: 1280, height: 720 } : { width: 1280, height: 720 },
        audio: false,
      });
      const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      setCameras(all);
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      const ctx = canvasRef.current!.getContext('2d')!;
      const draw = new DrawingUtils(ctx);
      let raf = 0, last = -1, frames = 0, fpsAt = performance.now();
      let hands = 0, active = false, maxHands = 0, withHand = 0, anyActive = false;
      const loop = () => {
        if (v.readyState >= 2) {
          const t = performance.now();
          if (t > last) {
            last = t;
            const h = hand.detectForVideo(v, t);
            const p = pose.detectForVideo(v, t);
            const f = frameFeatures(p.landmarks[0], h.landmarks, v.videoWidth, v.videoHeight);
            hands = h.landmarks.length; active = !!f && isActive(f);
            cb.current(f, t);
            const c = canvasRef.current!;
            if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
            ctx.clearRect(0, 0, c.width, c.height);
            const pl = p.landmarks[0];
            if (pl) {
              ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 4;
              for (const [a, b] of POSE_LINKS) {
                ctx.beginPath(); ctx.moveTo(pl[a].x * c.width, pl[a].y * c.height);
                ctx.lineTo(pl[b].x * c.width, pl[b].y * c.height); ctx.stroke();
              }
            }
            for (const lm of h.landmarks) {
              draw.drawConnectors(lm, HandLandmarker.HAND_CONNECTIONS, { color: active ? '#22c55e' : '#a3a3a3', lineWidth: 4 });
              draw.drawLandmarks(lm, { color: '#ef4444', radius: 3 });
            }
            frames++;
            maxHands = Math.max(maxHands, hands); withHand += hands > 0 ? 1 : 0; anyActive ||= active;
            if (t - fpsAt > 500) {
              setLive({
                hands: maxHands, active: anyActive, fps: Math.round((frames * 1000) / (t - fpsAt)),
                seen: Math.round((100 * withHand) / frames),
              });
              frames = 0; fpsAt = t; maxHands = 0; withHand = 0; anyActive = false;
            }
          }
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
      stop.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((tr) => tr.stop());
        hand.close(); pose.close();
      };
      setStatus('running');
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? String(e));
      setStatus('error');
    }
  }, [cameraId]);

  const chooseCamera = useCallback((id: string) => {
    setCameraId(id);
    try { localStorage.setItem('expresso.camera', id); } catch { /* private mode */ }
    start(id);
  }, [start]);

  useEffect(() => () => stop.current(), []);

  return { videoRef, canvasRef, status, error, start, cameras, cameraId, chooseCamera, live };
}
