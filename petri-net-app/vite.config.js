import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'z3-static-assets',
      configureServer(server) {
        const require = createRequire(import.meta.url);
        // Resolve z3-solver installation directory robustly in ESM
        let z3DirCandidates = [];
        try {
          const z3PkgPath = require.resolve('z3-solver/package.json');
          const z3PkgDir = path.dirname(z3PkgPath);
          z3DirCandidates.push(path.join(z3PkgDir, 'build'));
          z3DirCandidates.push(z3PkgDir);
        } catch (_) {}
        // Fallbacks based on CWD and this config file location
        try {
          const cwd = process.cwd();
          z3DirCandidates.push(path.resolve(cwd, 'node_modules', 'z3-solver', 'build'));
          z3DirCandidates.push(path.resolve(cwd, 'node_modules', 'z3-solver'));
        } catch (_) {}
        try {
          const __filename = fileURLToPath(import.meta.url);
          const __dirnameESM = path.dirname(__filename);
          z3DirCandidates.push(path.resolve(__dirnameESM, 'node_modules', 'z3-solver', 'build'));
          z3DirCandidates.push(path.resolve(__dirnameESM, 'node_modules', 'z3-solver'));
        } catch (_) {}

        const pickZ3Dir = () => {
          for (const dir of z3DirCandidates) {
            try {
              if (fs.existsSync(path.join(dir, 'z3-built.js'))) return dir;
            } catch (_) {}
          }
          return null;
        };
        const z3Dir = pickZ3Dir();

        server.middlewares.use((req, res, next) => {
          if (!req.url) return next();
          const map = {
            '/z3-built.js': 'z3-built.js',
            '/z3-built.wasm': 'z3-built.wasm'
          };
          if (map[req.url] && z3Dir) {
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
