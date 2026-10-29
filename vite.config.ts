import { mkdir, writeFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const CAPTURE_FILE = 'src/layouts/capture/ru-mac-iso.json';

// Dev-only endpoint for debug/keys.html: writes the captured layout to CAPTURE_FILE (SPEC §3).
function saveLayoutCapture(): Plugin {
  return {
    name: 'save-layout-capture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-layout-capture', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => (body += chunk));
        req.on('end', () => {
          void (async () => {
            try {
              JSON.parse(body);
              await mkdir('src/layouts/capture', { recursive: true });
              await writeFile(CAPTURE_FILE, body + '\n');
              res.end(CAPTURE_FILE);
            } catch (err) {
              res.statusCode = 400;
              res.end(String(err));
            }
          })();
        });
      });
    },
  };
}

export default defineConfig({
  // Relative asset paths so dist/ works on any static host (see SPEC §10).
  base: './',
  plugins: [saveLayoutCapture()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
