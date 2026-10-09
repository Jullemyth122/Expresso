import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';

// Local copy of the MediaPipe runtime (public/mediapipe/wasm), so the demo needs no CDN.
const WASM = '/mediapipe/wasm';

// GPU is faster, but some laptops (AMD + NVIDIA) fail to start it, so fall back to CPU.
async function withFallback<T>(make: (delegate: 'GPU' | 'CPU') => Promise<T>) {
  try { return await make('GPU'); } catch (e) { console.warn('GPU delegate failed, using CPU', e); return make('CPU'); }
}

export async function createLandmarkers() {
  const vision = await FilesetResolver.forVisionTasks(WASM);
  const hand = await withFallback((delegate) => HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/mediapipe/hand_landmarker.task', delegate },
    runningMode: 'VIDEO', numHands: 2,
    // Default is 0.5; lower keeps hold of fast-moving, slightly blurred hands in dim rooms
    minHandDetectionConfidence: 0.3, minHandPresenceConfidence: 0.3, minTrackingConfidence: 0.3,
  }));
  const pose = await withFallback((delegate) => PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/mediapipe/pose_landmarker_lite.task', delegate },
    runningMode: 'VIDEO', numPoses: 1,
  }));
  return { hand, pose };
}
