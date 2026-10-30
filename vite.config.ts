import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SINGLE=1 이면 한 파일로 묶기 쉽게 동적 import를 인라인한다 (배포용 단일 HTML)
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: process.env.SINGLE ? { output: { inlineDynamicImports: true } } : {},
  },
});
