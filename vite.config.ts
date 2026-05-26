import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// CF Pages serves the Vite build output (dist/) plus functions/ at the edge.
// In local dev, `vite` serves the SPA with HMR and proxies /api/* to a
// `wrangler pages dev` instance (npm run dev:cf) so Functions + D1 work.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 8787,
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:8788',
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
