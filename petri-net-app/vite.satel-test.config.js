import { mergeConfig } from 'vite';
import base from './vite.config.js';
// Separate test build: the harness and its diagnostic worker never enter dist.
export default mergeConfig(base, {
  build: { outDir: process.env.SATEL_TEST_OUTDIR || 'dist-satel-test', rollupOptions: { input: ['index.html', 'tests/e2e/satel/fixtures/lifecycle.html'] } },
  preview: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } }
});
