import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'z3-static-assets',
      configureServer(server) {
        const z3Dir = path.resolve(__dirname, 'node_modules', 'z3-solver', 'build');
        server.middlewares.use((req, res, next) => {
          if (!req.url) return next();
          const map = {
            '/z3-built.js': 'z3-built.js',
            '/z3-built.wasm': 'z3-built.wasm',
            '/z3-built.worker.js': 'z3-built.worker.js'
          };
          if (map[req.url]) {
            const fp = path.join(z3Dir, map[req.url]);
            if (fs.existsSync(fp)) {
              res.setHeader('Content-Type', req.url.endsWith('.wasm') ? 'application/wasm' : 'application/javascript');
              // Ensure cross-origin isolation applies to these assets as well
              res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
              res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
              res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
              fs.createReadStream(fp).pipe(res);
              return;
            }
          }
          next();
        });
      }
    }
  ],
  define: {
    global: 'globalThis'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
    },
  },
  server: {
    port: 3000,
    open: true,
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  optimizeDeps: {
    include: ['z3-solver'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  }
});
