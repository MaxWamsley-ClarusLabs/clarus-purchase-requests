// Runs the reading test in Chromium (the same engine as Edge) against every case in receipts/truth.json.
import { chromium } from '../../../app/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.gz': 'application/gzip', '.json': 'application/json' };
const server = createServer((req, res) => {
  const p = join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !existsSync(p)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }).end(readFileSync(p));
}).listen(8765);

const cases = JSON.parse(readFileSync(root + 'work/receipts/truth.json', 'utf8'));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error', e.message));
await page.goto('http://127.0.0.1:8765/page.html');
await page.waitForFunction('window.ready === true');

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function vendorScore(got, want) {
  const g = norm(got), w = norm(want);
  if (!g) return 'missing';
  if (g === w) return 'right';
  if (lev(g, w) <= 2) return 'close';
  return 'wrong';
}

const results = [];
for (const c of cases) {
  const r = await page.evaluate((u) => window.readReceipt(u), `/work/receipts/${c.file}`);
  const row = {
    file: c.file, kind: c.kind, method: r.method, ms: r.ms, confidence: r.confidence,
    date: r.date === c.date ? 'right' : r.date ? 'wrong' : 'missing', gotDate: r.date, wantDate: c.date,
    total: r.total === c.total ? 'right' : r.total ? 'wrong' : 'missing', gotTotal: r.total, wantTotal: c.total,
    vendor: vendorScore(r.vendor, c.vendor), gotVendor: r.vendor, wantVendor: c.vendor, text: r.text
  };
  results.push(row);
  console.log([row.file.padEnd(52), row.method.padEnd(22), String(row.ms).padStart(6), row.date.padEnd(7), row.total.padEnd(7), row.vendor.padEnd(7), `${r.gotTotal ?? r.total}`, `"${r.vendor}"`].join(' '));
}
await browser.close();
server.close();
writeFileSync(root + 'work/results.json', JSON.stringify(results, null, 2));
