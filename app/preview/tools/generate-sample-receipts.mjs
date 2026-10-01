// Generates the synthetic sample files in test/fixtures/receipts: quotes,
// invoices and receipts for the sample requests (src/data/mock/sampleData.ts).
// Every file is marked as a synthetic test sample; vendors are made up. Each has
// the vendor at the top, a date line and a Total line, a layout the receipt
// reader reads (src/domain/receiptText.ts). Also writes truth.json, the answers
// for preview/tools/check-reader.mjs.
// Run: node preview/tools/generate-sample-receipts.mjs (from app/)
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const outDir = fileURLToPath(new URL('../../../test/fixtures/receipts/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const documents = [
  {
    file: 'acme-lab-supply-quote.pdf',
    kind: 'quote',
    vendor: 'Acme Lab Supply',
    date: '2026-09-28',
    lines: [
      ['Pipette tips, 10 racks', '412.00'],
      ['Centrifuge tubes, 50 mL, 500 count', '228.00']
    ],
    total: '640.00',
    footer: 'Valid for 30 days.'
  },
  {
    file: 'acme-lab-supply-invoice.pdf',
    kind: 'invoice',
    vendor: 'Acme Lab Supply',
    date: '2026-10-14',
    lines: [
      ['Pipette tips, 10 racks', '412.00'],
      ['Centrifuge tubes, 50 mL, 500 count', '228.00']
    ],
    total: '640.00',
    footer: 'Terms: net 30.'
  },
  {
    file: 'harbor-software-quote.pdf',
    kind: 'quote',
    vendor: 'Harbor Software',
    date: '2026-09-27',
    lines: [['Annual licence, analysis software, 5 seats', '870.00']],
    total: '870.00',
    footer: 'Valid for 30 days.'
  },
  {
    file: 'harbor-software-invoice.pdf',
    kind: 'invoice',
    vendor: 'Harbor Software',
    date: '2026-10-06',
    lines: [['Annual licence, analysis software, 5 seats', '870.00']],
    total: '870.00',
    footer: 'Terms: net 30.'
  },
  {
    file: 'blue-fern-web-invoice.pdf',
    kind: 'invoice',
    vendor: 'Blue Fern Web Co.',
    date: '2026-09-18',
    lines: [
      ['Website hosting, 12 months', '620.00'],
      ['Search marketing package', '520.00']
    ],
    total: '1,140.00',
    footer: 'Terms: due on receipt.'
  },
  {
    file: 'northwind-office-receipt.png',
    kind: 'receipt',
    vendor: 'Northwind Office Supply',
    date: '2026-10-07',
    lines: [
      ['Printer paper, 5 reams', '38.45'],
      ['Toner cartridge', '40.00'],
      ['Tax', '8.00']
    ],
    total: '86.45',
    footer: 'Paid: Card ending 0000'
  },
  {
    file: 'quickship-postage-receipt.png',
    kind: 'receipt',
    vendor: 'QuickShip Postage',
    date: '2026-10-08',
    lines: [
      ['Priority parcel, 2 lb', '14.20'],
      ['Insurance', '4.40'],
      ['Tracking label', '6.00']
    ],
    total: '24.60',
    footer: 'Paid: Card ending 0000'
  },
  {
    file: 'summit-training-receipt.pdf',
    kind: 'receipt',
    vendor: 'Summit Training Institute',
    date: '2026-10-05',
    lines: [['Laboratory safety course, 2 days', '450.00']],
    total: '450.00',
    footer: 'Paid: Card ending 0000'
  },
  {
    file: 'kestrel-instruments-quote.pdf',
    kind: 'quote',
    vendor: 'Kestrel Instruments',
    date: '2026-09-20',
    lines: [['Benchtop sensor kit, model KI-200', '1,150.00']],
    total: '1,150.00',
    footer: 'Valid for 30 days.'
  },
  {
    file: 'kestrel-instruments-invoice.pdf',
    kind: 'invoice',
    vendor: 'Kestrel Instruments',
    date: '2026-10-02',
    lines: [['Benchtop sensor kit, model KI-200', '1,150.00']],
    total: '1,150.00',
    footer: 'Terms: net 30.'
  }
];

const TITLE = { quote: 'Quote', invoice: 'Invoice', receipt: 'Receipt' };

function html(d) {
  const rows = d.lines.map(([text, amount]) => `<tr><td>${text}</td><td class="amt">$${amount}</td></tr>`).join('');
  const title = TITLE[d.kind];
  return `<!doctype html><html><head><style>
    body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#fff;color:#222}
    .r{width:360px;padding:24px;border:1px dashed #999;margin:12px}
    h1{font-size:20px;margin:0 0 4px} .muted{color:#666;font-size:12px}
    table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
    td{padding:4px 0;border-bottom:1px solid #eee} .amt{text-align:right}
    .total{font-weight:bold;font-size:16px}
    .stamp{margin-top:14px;padding:6px;border:2px solid #b42318;color:#b42318;font-weight:bold;text-align:center;font-size:12px}
  </style></head><body><div class="r">
    <h1>${d.vendor}</h1>
    <div class="muted">${title} date ${d.date}</div>
    <table>${rows}<tr class="total"><td>Total</td><td class="amt">$${d.total}</td></tr></table>
    <div class="muted">${d.footer}</div>
    <div class="stamp">SYNTHETIC SAMPLE FOR TESTING. NOT A REAL ${title.toUpperCase()}.</div>
  </div></body></html>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 520 }, deviceScaleFactor: 2 });
for (const d of documents) {
  await page.setContent(html(d));
  if (d.file.endsWith('.pdf')) {
    await page.pdf({ path: outDir + d.file, width: '4.5in', height: '6in', printBackground: true });
  } else {
    await page.locator('.r').screenshot({ path: outDir + d.file });
  }
}
await browser.close();

// What the reader should find on each file, in the format check-reader.mjs reads.
const truth = documents.map((d) => ({ file: d.file, kind: d.kind, date: d.date, total: d.total.replace(/,/g, ''), vendor: d.vendor }));
writeFileSync(outDir + 'truth.json', JSON.stringify(truth, null, 2) + '\n');
console.log(`Wrote ${documents.length} synthetic files and truth.json to ${outDir}`);
