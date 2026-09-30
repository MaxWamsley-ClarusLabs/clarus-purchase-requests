// Measures the app's receipt reader (D-074) on synthetic receipts, in Chromium
// (the engine Edge uses), through the same code the app runs.
// Start the preview first (npm run preview), then:
//   node preview/tools/check-reader.mjs [folder]
// The folder holds the receipts and a truth.json listing { file, kind, date,
// total, vendor } for each. The default is the accuracy test's set, made by
// docs/research/receipt-reading/gen.mjs. Prints one line per receipt and a
// summary; exits with 1 if any field is read wrong (empty is allowed).
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:5173/';
const folder = process.argv[2] || fileURLToPath(new URL('../../../docs/research/receipt-reading/work/receipts/', import.meta.url));
const cases = JSON.parse(readFileSync(`${folder.replace(/\/?$/, '/')}truth.json`, 'utf8'));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
await page.goto(`${BASE}?user=jane&shot=1`);
await page.waitForSelector('.ctx-main');

const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const score = (got, want) => (got === '' || got === null ? 'empty' : got === want ? 'right' : 'wrong');
const tally = { right: 0, wrong: 0, empty: 0 };
let slowest = 0;

for (const c of cases) {
  const base64 = readFileSync(`${folder.replace(/\/?$/, '/')}${c.file}`).toString('base64');
  const r = await page.evaluate(
    async ([name, data]) => {
      const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
      const t0 = performance.now();
      const guess = await window.previewReader.read(new Blob([bytes]), name);
      return { guess, ms: Math.round(performance.now() - t0) };
    },
    [c.file, base64]
  );
  if (!r.guess) {
    problems.push(`${c.file}: the reader did not run`);
    continue;
  }
  const g = r.guess;
  const wantCents = Math.round(Number(c.total) * 100);
  const date = score(g.date, c.date);
  const total = score(g.amountCents, wantCents);
  const vendor = g.vendor ? (norm(g.vendor) === norm(c.vendor) ? 'right' : 'wrong') : 'empty';
  for (const s of [date, total, vendor]) tally[s] += 1;
  slowest = Math.max(slowest, r.ms);
  console.log(
    [c.file.padEnd(52), String(r.ms).padStart(6), date.padEnd(6), total.padEnd(6), vendor.padEnd(6), g.date, g.amountCents, `"${g.vendor}"`].join(' ')
  );
}

await browser.close();
console.log(`\n${cases.length} receipts, ${cases.length * 3} fields: ${tally.right} right, ${tally.wrong} wrong, ${tally.empty} empty. Slowest ${slowest} ms.`);
if (problems.length) console.log(`Problems:\n${problems.join('\n')}`);
process.exit(tally.wrong > 0 || problems.length > 0 ? 1 : 0);
