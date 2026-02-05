import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: "/",
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_PUSH_SERVER_URL': JSON.stringify(env.VITE_PUSH_SERVER_URL || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Ensure sw.js and manifest are copied to dist
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
          }
        },
        // Copy static assets properly
        copyPublicDir: true,
        // Add source maps for debugging (optional, can be removed in production)
        sourcemap: false,
      }
    };
});
