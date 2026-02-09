import { defineConfig } from 'vite';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Tiny Vite plugin that exposes POST /__extract so the in-browser
 * refresh button can trigger a re-extraction from the Excel source.
 */
function extractPlugin() {
  const pythonBin = resolve('.venv/bin/python3');
  const script = resolve('extract_budget.py');

  return {
    name: 'budget-extract',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method === 'POST' && req.url === '/__extract') {
          execFile(pythonBin, [script], { timeout: 30_000 }, (err, stdout, stderr) => {
            res.setHeader('Content-Type', 'application/json');
            if (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: stderr || err.message }));
            } else {
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, output: stdout.trim() }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  plugins: [extractPlugin()],
});
