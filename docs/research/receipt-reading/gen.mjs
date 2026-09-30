// Generates hard synthetic receipt variants for the reading-accuracy test (D-074).
// All vendors are made up; every file carries a SYNTHETIC SAMPLE stamp.
import { chromium } from '../../../app/node_modules/playwright-core/index.mjs';
import { mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';

const out = new URL('./work/receipts/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

// Base receipts: the six from the repository plus three with other layouts.
const base = [
  { id: 'cab', vendor: 'City Cab Co.', date: '2026-09-14', total: '45.00', lines: [['Airport to hotel', '38.50'], ['Tip', '6.50']], paid: 'Cash' },
  { id: 'bistro', vendor: 'Blue Door Bistro', date: '2026-09-15', total: '140.00', lines: [['Dinner for 3', '118.40'], ['Tip', '21.60']], paid: 'Visa ending 0000' },
  { id: 'parking', vendor: 'Metro Parking', date: '2026-09-17', total: '72.00', lines: [['Airport parking, 4 days', '72.00']], paid: 'Mastercard ending 0000' },
  { id: 'airline', vendor: 'Skyway Airlines', date: '2026-08-20', total: '452.30', lines: [['Round trip, economy', '412.30'], ['Seat selection', '40.00']], paid: 'Visa ending 0000' },
  { id: 'hotel', vendor: 'Harbor View Hotel', date: '2026-09-17', total: '654.34', lines: [['Room, 3 nights', '537.00'], ['Room tax', '75.24'], ['Harbor Grill restaurant', '42.10']], paid: 'Mastercard ending 0000' },
  { id: 'conf', vendor: 'Northeast Science Conference', date: '2026-08-10', total: '395.00', lines: [['Full registration', '395.00']], paid: 'Visa ending 0000' }
];

// Layouts closer to real till receipts: address block, subtotal and tax before the total,
// other date formats and total labels.
const retail = [
  {
    id: 'coffee', vendor: 'Pine Street Coffee', date: '2026-09-16', dateText: 'Sep 16, 2026 7:42 AM', total: '14.85', totalLabel: 'TOTAL',
    address: ['418 Pine Street', 'Springfield, IL 62701', 'Tel (217) 555-0142'],
    lines: [['Latte, large', '5.95'], ['Egg sandwich', '7.25'], ['Subtotal', '13.20'], ['Tax 8.5%', '1.12'], ['Tip', '0.53']], welcome: true
  },
  {
    id: 'fuel', vendor: 'Lakeside Fuel Stop', date: '2026-09-18', dateText: '09/18/26 16:05', total: '58.42', totalLabel: 'AMOUNT DUE',
    address: ['Store #2291', '1200 Route 9 North', 'Albany, NY 12205'],
    lines: [['Regular 14.021 gal @ 3.899', '54.67'], ['Snack', '3.75'], ['Subtotal', '58.42']], welcome: false
  },
  {
    id: 'rental', vendor: 'Evergreen Car Rental', date: '2026-09-19', dateText: '19-SEP-2026', total: '287.61', totalLabel: 'TOTAL USD',
    address: ['Airport Location 17', 'Agreement 5550-1938'],
    lines: [['Compact, 3 days @ 69.00', '207.00'], ['Fuel service', '31.18'], ['Subtotal', '238.18'], ['Taxes and fees', '49.43']], welcome: false
  }
];

const STAMP = 'SYNTHETIC SAMPLE FOR TESTING. NOT A REAL RECEIPT.';

function simpleHtml(r, style) {
  const rows = r.lines.map(([d, a]) => `<tr><td>${d}</td><td class="amt">$${a}</td></tr>`).join('');
  return `<div class="r ${style}"><h1>${r.vendor}</h1><div class="muted">Receipt date ${r.date}</div>
    <table>${rows}<tr class="total"><td>Total</td><td class="amt">$${r.total}</td></tr></table>
    <div class="muted">Paid: ${r.paid}</div><div class="stamp">${STAMP}</div></div>`;
}

function retailHtml(r, style) {
  const rows = r.lines.map(([d, a]) => `<tr><td>${d}</td><td class="amt">${a}</td></tr>`).join('');
  return `<div class="r ${style}">
    <div class="c">${r.welcome ? 'WELCOME TO<br>' : ''}<b class="v">${r.vendor.toUpperCase()}</b><br>${r.address.join('<br>')}</div>
    <div class="c">${r.dateText}</div>
    <table>${rows}<tr class="total"><td>${r.totalLabel}</td><td class="amt">$${r.total}</td></tr></table>
    <div class="c">VISA ****0000 APPROVED<br>THANK YOU!</div><div class="stamp">${STAMP}</div></div>`;
}

const css = `
  body{margin:0;background:#fff;color:#222;font-family:Arial,Helvetica,sans-serif}
  .r{width:360px;padding:24px;border:1px dashed #999;margin:12px;background:#fff}
  h1{font-size:20px;margin:0 0 4px} .muted{color:#666;font-size:12px}
  table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
  td{padding:4px 0;border-bottom:1px solid #eee} .amt{text-align:right}
  .total{font-weight:bold;font-size:16px} .c{text-align:center;margin:6px 0;font-size:13px} .v{font-size:17px}
  .stamp{margin-top:14px;padding:6px;border:2px solid #b42318;color:#b42318;font-weight:bold;text-align:center;font-size:12px}
  .thermal{font-family:'Courier 10 Pitch','FreeMono',monospace;color:#8c8c8c;background:#f3efe6;border:none;width:300px}
  .thermal td{border:none;padding:2px 0} .thermal .stamp{color:#b99;border-color:#dbb}
  .small{width:360px;font-size:11px} .small h1{font-size:14px} .small table{font-size:10px}
  .stage{padding:40px;background:#6b6b6b;display:inline-block}
  .photo{transform:perspective(900px) rotateX(6deg) rotateZ(-3.5deg);filter:blur(0.7px) brightness(0.93);box-shadow:4px 8px 18px rgba(0,0,0,.6)}
  .noise{position:relative} .noise:after{content:'';position:absolute;inset:0;pointer-events:none;
    background-image:radial-gradient(rgba(0,0,0,.18) 1px,transparent 1.2px);background-size:5px 7px;mix-blend-mode:multiply}
  .fade{filter:blur(0.5px) contrast(0.75)}
`;

const cases = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function shot(file, body, { scale = 2, sel = '.r', jpeg = 0 } = {}) {
  const page = await browser.newPage({ viewport: { width: 700, height: 900 }, deviceScaleFactor: scale });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${body}</body></html>`);
  const opts = { path: out + file };
  if (jpeg) Object.assign(opts, { type: 'jpeg', quality: jpeg });
  await page.locator(sel).first().screenshot(opts);
  await page.close();
}

async function imagePdf(file, imgFile) {
  const page = await browser.newPage();
  const b64 = readFileSync(out + imgFile).toString('base64');
  const mime = imgFile.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
  await page.setContent(`<html><body style="margin:0"><img src="data:${mime};base64,${b64}" style="width:100%"></body></html>`);
  await page.pdf({ path: out + file, width: '5in', height: '7in' });
  await page.close();
}

const truth = (r) => ({ vendor: r.vendor, date: r.date, total: r.total });

// 1. The repository's own files (clean, as used in the preview).
const repo = new URL('../../../test/fixtures/receipts/', import.meta.url).pathname;
const repoFiles = { cab: 'city-cab-receipt.png', bistro: 'blue-door-bistro.png', parking: 'metro-parking.png', airline: 'skyway-airlines-eticket.pdf', hotel: 'harbor-view-hotel-folio.pdf', conf: 'northeast-science-conference-registration.pdf' };
for (const r of base) {
  const f = `repo_${repoFiles[r.id]}`;
  copyFileSync(repo + repoFiles[r.id], out + f);
  cases.push({ file: f, kind: 'clean (repository file)', ...truth(r) });
}

// 2. Hard variants of every receipt.
for (const r of [...base, ...retail]) {
  const html = (style) => (r.lines && r.dateText ? retailHtml(r, style) : simpleHtml(r, style));
  if (r.dateText) {
    await shot(`${r.id}_clean.png`, html(''));
    cases.push({ file: `${r.id}_clean.png`, kind: 'clean till layout', ...truth(r) });
  }
  await shot(`${r.id}_phone.jpg`, `<div class="stage">${html('photo')}</div>`, { scale: 1.5, sel: '.stage', jpeg: 55 });
  cases.push({ file: `${r.id}_phone.jpg`, kind: 'phone photo (tilted, blurred, JPEG)', ...truth(r) });
  await shot(`${r.id}_thermal.jpg`, `<div class="noise" style="display:inline-block">${html('thermal fade')}</div>`, { scale: 1.5, sel: '.noise', jpeg: 60 });
  cases.push({ file: `${r.id}_thermal.jpg`, kind: 'faded thermal paper with heavy speckle', ...truth(r) });
  await shot(`${r.id}_faded.jpg`, html('thermal fade'), { scale: 1.5, jpeg: 60 });
  cases.push({ file: `${r.id}_faded.jpg`, kind: 'faded thermal paper, no speckle', ...truth(r) });
  await shot(`${r.id}_lowres.png`, html('small'), { scale: 1 });
  cases.push({ file: `${r.id}_lowres.png`, kind: 'small, low resolution', ...truth(r) });
  await imagePdf(`${r.id}_scanned.pdf`, `${r.id}_phone.jpg`);
  cases.push({ file: `${r.id}_scanned.pdf`, kind: 'scanned PDF (no text layer)', ...truth(r) });
}

await browser.close();
writeFileSync(out + 'truth.json', JSON.stringify(cases, null, 2));
console.log(`${cases.length} cases written`);
