/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    exclude: ['@moyin/net-client'],
  },
  server: {
    port: 38880,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:38881',
        changeOrigin: true,
      },
    },
    fs: {
      allow: ['..', '../../../common/moyin-net-client'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: !!process.env.DEBUG,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          markdown: ['react-markdown', 'react-syntax-highlighter'],
          motion: ['framer-motion'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
