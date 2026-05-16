import { defineConfig } from 'vite';

// Phase 4 — step 1: Vite as the dev server / build tool, coexisting with the
// existing global <script> tags. No ESM rewrite yet; this just adds the
// bundler infrastructure without changing how the app loads.
//
// Dev:   vite           → http://localhost:5173, /api proxied to Node :3001
// Build: vite build     → dist/
// The Express server (server/index.js) still works standalone as before.
export default defineConfig({
    root: '.',
    appType: 'spa', // History-API routing: serve index.html for unknown paths
    server: {
        port: 5173,
        strictPort: false,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        // The legacy scripts are plain (non-module) globals. Don't let Vite
        // try to tree-shake/transform them yet — copy them through. Full
        // ESM modularization is the next increment.
        rollupOptions: {
            output: { manualChunks: undefined }
        }
    }
});
