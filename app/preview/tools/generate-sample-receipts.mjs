// Generates the synthetic sample receipts in test/fixtures/receipts.
// Every file is marked as a synthetic test sample; vendors are made up.
// Run: node preview/tools/generate-sample-receipts.mjs (from app/)
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const outDir = fileURLToPath(new URL('../../../test/fixtures/receipts/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const receipts = [
  {
    file: 'skyway-airlines-eticket.pdf',
    vendor: 'Skyway Airlines',
    date: '2026-08-20',
    lines: [
      ['Round trip, economy', '412.30'],
      ['Seat selection', '40.00']
    ],
    total: '452.30',
    paid: 'Visa ending 0000'
  },
  {
    file: 'harbor-view-hotel-folio.pdf',
    vendor: 'Harbor View Hotel',
    date: '2026-09-17',
    lines: [
      ['Room, 3 nights', '537.00'],
      ['Room tax', '75.24'],
      ['Harbor Grill restaurant', '42.10']
    ],
    total: '654.34',
    paid: 'Mastercard ending 0000'
  },
  {
    file: 'northeast-science-conference-registration.pdf',
    vendor: 'Northeast Science Conference',
    date: '2026-08-10',
    lines: [['Full registration', '395.00']],
    total: '395.00',
    paid: 'Visa ending 0000'
  },
  {
    file: 'city-cab-receipt.png',
    vendor: 'City Cab Co.',
    date: '2026-09-14',
    lines: [
      ['Airport to hotel', '38.50'],
      ['Tip', '6.50']
    ],
    total: '45.00',
    paid: 'Cash'
  },
  {
    file: 'blue-door-bistro.png',
    vendor: 'Blue Door Bistro',
    date: '2026-09-15',
    lines: [
      ['Dinner for 3', '118.40'],
      ['Tip', '21.60']
    ],
    total: '140.00',
    paid: 'Visa ending 0000'
  },
  {
    file: 'metro-parking.png',
    vendor: 'Metro Parking',
    date: '2026-09-17',
    lines: [['Airport parking, 4 days', '72.00']],
    total: '72.00',
    paid: 'Mastercard ending 0000'
  }
];

function html(r) {
  const rows = r.lines.map(([d, a]) => `<tr><td>${d}</td><td class="amt">$${a}</td></tr>`).join('');
  return `<!doctype html><html><head><style>
    body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#fff;color:#222}
    .r{width:360px;padding:24px;border:1px dashed #999;margin:12px}
    h1{font-size:20px;margin:0 0 4px} .muted{color:#666;font-size:12px}
    table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
    td{padding:4px 0;border-bottom:1px solid #eee} .amt{text-align:right}
    .total{font-weight:bold;font-size:16px}
    .stamp{margin-top:14px;padding:6px;border:2px solid #b42318;color:#b42318;font-weight:bold;text-align:center;font-size:12px}
  </style></head><body><div class="r">
    <h1>${r.vendor}</h1>
    <div class="muted">Receipt date ${r.date}</div>
    <table>${rows}<tr class="total"><td>Total</td><td class="amt">$${r.total}</td></tr></table>
    <div class="muted">Paid: ${r.paid}</div>
    <div class="stamp">SYNTHETIC SAMPLE FOR TESTING. NOT A REAL RECEIPT.</div>
  </div></body></html>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 520 }, deviceScaleFactor: 2 });
for (const r of receipts) {
  await page.setContent(html(r));
  if (r.file.endsWith('.pdf')) {
    await page.pdf({ path: outDir + r.file, width: '4.5in', height: '6in', printBackground: true });
  } else {
    await page.locator('.r').screenshot({ path: outDir + r.file });
  }
}
await browser.close();
console.log(`Wrote ${receipts.length} synthetic receipts to ${outDir}`);
