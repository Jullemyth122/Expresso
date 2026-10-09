import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { expressoApi } from './server/api.ts';

// Expresso runs only on this computer: the dev server listens on 127.0.0.1 and serves the /api routes itself.
export default defineConfig({
  plugins: [react(), expressoApi()],
  optimizeDeps: { exclude: ['onnxruntime-web'] },
});
