// Local preview harness for the prototype (Stage 6). Runs the real app screens
// on sample data. SharePoint is not involved; see preview/main.tsx.
import { createReadStream, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const here = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Serves the receipt reader's files at /reader/, under the same names the
 * SharePoint build gives them (config/webpack-patch/receipt-reader.js, D-074).
 */
function receiptReaderFiles(): Plugin {
  const table = require('../config/webpack-patch/receipt-reader.js').RECEIPT_READER_FILES as Record<string, [string, string]>;
  const files = new Map(Object.entries(table).map(([name, [request, from]]) => [name, require.resolve(request, { paths: [from] })]));
  return {
    name: 'receipt-reader-files',
    configureServer(server) {
      server.middlewares.use('/reader', (req, res, next) => {
        const file = files.get(decodeURIComponent((req.url ?? '').split('?')[0].replace(/^\//, '')));
        if (!file) return next();
        res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const [name, file] of files) this.emitFile({ type: 'asset', fileName: `reader/${name}`, source: readFileSync(file) });
    }
  };
}

export default defineConfig({
  root: here,
  // Synthetic sample receipts live in the repository's test fixtures folder.
  publicDir: fileURLToPath(new URL('../../test/fixtures', import.meta.url)),
  plugins: [react({ jsxRuntime: 'classic' }), receiptReaderFiles()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: fileURLToPath(new URL('../preview-dist', import.meta.url)), emptyOutDir: true }
});
