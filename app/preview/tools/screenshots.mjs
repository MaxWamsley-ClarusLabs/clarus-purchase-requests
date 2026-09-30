// Captures the prototype screens into docs/prototype/ for review.
// Start the preview first (npm run preview), then: node preview/tools/screenshots.mjs
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:5173/';
const outDir = fileURLToPath(new URL('../../../docs/prototype/', import.meta.url));
const receipts = fileURLToPath(new URL('../../../test/fixtures/receipts/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const problems = [];

async function open(user, hash, width = 1440, height = 900, extra = '') {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('console', (m) => m.type() === 'error' && problems.push(`${user} ${hash}: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${user} ${hash}: ${e.message}`));
  await page.goto(`${BASE}?user=${user}&shot=1${extra ? `&${extra}` : ''}${hash}`);
  await page.waitForSelector('.ctx-main');
  await page.waitForTimeout(700);
  return page;
}

async function shot(page, name, fullPage = true) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage });
  console.log('saved', name);
}

// Employee
let p = await open('jane', '#/');
await shot(p, '01-my-reports');
await p.getByRole('button', { name: 'New report' }).click();
await p.waitForSelector('text=New trip report');
await shot(p, '02-new-report-trip-details');
// Check the defaults (D-057) in a real browser: first row Company card, category from a known vendor.
await p.getByRole('button', { name: 'Next: Expenses' }).click();
await p.getByRole('button', { name: 'Add expense without receipt' }).click();
await p.getByLabel('Row 1 vendor').fill('Skyway Airlines');
await p.waitForTimeout(300);
const paid = await p.getByLabel('Row 1 paid with').inputValue();
const category = await p.getByLabel('Row 1 category').inputValue();
await p.getByRole('button', { name: 'Add expense without receipt' }).click();
await p.getByLabel('Row 1 paid with').selectOption('personal');
await p.waitForTimeout(700);
await p.getByRole('button', { name: 'Add expense without receipt' }).click();
const thirdPaid = await p.getByLabel('Row 3 paid with').inputValue();
const checks = { firstRowPaidWith: paid === 'companyCard', categoryFromVendor: category === 'airfare', newRowCopiesRowAbove: thirdPaid === 'companyCard' };
console.log('default checks', JSON.stringify(checks));
if (!Object.values(checks).every(Boolean)) problems.push('default checks failed: ' + JSON.stringify({ paid, category, thirdPaid }));
await p.close();

// Receipt suggestions (D-074, D-078): three receipts dropped on a new report are
// read in the browser, and what the app filled in is marked until confirmed.
p = await open('jane', '#/');
await p.getByRole('button', { name: 'New report' }).click();
await p.getByRole('button', { name: 'Next: Expenses' }).click();
await p
  .locator('input[type=file][multiple]')
  .setInputFiles(['city-cab-receipt.png', 'skyway-airlines-eticket.pdf', 'metro-parking.png'].map((f) => receipts + f));
await p.getByText('Suggestions filled in on 3 rows').waitFor({ timeout: 60000 });
const suggested = {
  cells: await p.locator('.ctx-cell.suggested').count(),
  cabVendor: await p.getByLabel('Row 1 vendor').inputValue(),
  cabAmount: await p.getByLabel('Row 1 amount').inputValue()
};
if (suggested.cells < 9 || suggested.cabVendor !== 'City Cab Co.' || suggested.cabAmount !== '45.00')
  problems.push('receipt suggestion checks failed: ' + JSON.stringify(suggested));
await p.mouse.move(0, 0);
await shot(p, '26-expenses-receipt-suggestions', false);
await p.close();

p = await open('jane', '#/report/41/trip');
await shot(p, '03-trip-details');
await p.close();

// A typical laptop screen (1440 wide): the grid takes the full width; the receipt slides over.
p = await open('jane', '#/report/41/expenses');
await shot(p, '04-expenses-laptop');
await p.getByRole('button', { name: /blue-door-bistro/ }).click();
await shot(p, '05-expenses-receipt-slide-over', false);
await p.keyboard.press('Escape');
await p.getByLabel('Row 4 menu').click();
await shot(p, '06-expenses-row-menu', false);
await p.close();

// A wide screen (1920): the receipt sits beside the grid.
p = await open('jane', '#/report/41/expenses', 1920, 1080);
await p.getByLabel('Row 6 vendor').click();
await shot(p, '07-expenses-wide-screen');
await p.close();

p = await open('jane', '#/report/41/review');
await shot(p, '08-review-with-problems');
// Fix the two problems in the grid, then submit.
await p.getByRole('button', { name: 'Fix' }).first().click();
await p.getByLabel('Row 7 paid with').selectOption('companyCard');
await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Next: Review' }).click();
await shot(p, '09-review-ready');
await p.getByRole('button', { name: 'Submit report' }).click();
// Submit stays disabled until the certification is ticked (D-064).
const dialogSubmit = p.getByRole('dialog').getByRole('button', { name: 'Submit report' });
if (!(await dialogSubmit.isDisabled())) throw new Error('Submit should be disabled until the certification is ticked');
await p.getByRole('dialog').getByRole('checkbox').check();
await shot(p, '10-submit-confirm', false);
await dialogSubmit.click();
await p.waitForTimeout(3600);
await shot(p, '11-submitted');
await p.close();

// Mileage (D-071): turn on the switch, then add a drive on the Expenses step.
p = await open('jane', '#/report/41/trip');
await p.getByLabel('I drove my own car on this trip.', { exact: false }).check();
await p.waitForTimeout(700);
await p.goto(`${BASE}?user=jane&shot=1#/report/41/expenses`);
await p.getByRole('button', { name: 'Add a drive' }).click();
await p.getByLabel('Mileage M1 date').fill('2026-09-14');
await p.getByLabel('Mileage M1 from').fill('Office');
await p.getByLabel('Mileage M1 to').fill('Boston Logan Airport');
await p.getByLabel('Mileage M1 miles').fill('42');
await p.waitForTimeout(700);
const mileageAmount = await p.locator('table.ctx-mileage tbody tr').first().locator('td.num').innerText();
if (mileageAmount.trim() !== '$31.92') throw new Error(`Mileage amount should be $31.92 at 76 cents a mile, got ${mileageAmount}`);
await p.getByText('Mileage (1)').scrollIntoViewIfNeeded();
await shot(p, '25-expenses-mileage', false);
await p.close();

p = await open('jane', '#/report/41/expenses?panel=instructions');
await shot(p, '12-instructions', false);
await p.close();

p = await open('sam', '#/');
await shot(p, '13-returned-report');
await p.close();

// Administrator
p = await open('admin', '#/admin/process');
await shot(p, '14-admin-reports-to-process');
await p.close();

p = await open('admin', '#/admin/report/38');
await shot(p, '15-admin-report-expenses');
await p.getByRole('tab', { name: 'Email' }).click();
await shot(p, '16-admin-report-email');
await p.getByRole('tab', { name: 'CSV file' }).click();
await shot(p, '17-admin-report-csv');
await p.getByRole('tab', { name: 'Folder contents' }).click();
await shot(p, '18-admin-report-folder');
await p.getByRole('button', { name: 'Return with a note' }).click();
await p.getByLabel('What needs correcting? The employee sees this note.').fill('Row 2: please attach the itemized hotel bill.');
await shot(p, '19-admin-return-dialog', false);
await p.close();

p = await open('admin', '#/admin/attention');
await shot(p, '20-admin-needs-attention');
await p.close();

p = await open('admin', '#/admin/report/39');
await shot(p, '21-admin-failed-package');
await p.close();

// A new travel site: the administrator sees only Set-up until the lists exist (D-063).
p = await open('admin', '#/admin/process', 1440, 900, 'setup=new');
await shot(p, '22-admin-setup-new-site');
await p.getByRole('button', { name: 'Create the lists' }).click();
await p.getByText('The lists are ready.').waitFor();
await shot(p, '23-admin-setup-done');
// Step 2: the flow package for the test site (D-047).
const download = p.waitForEvent('download');
await p.getByRole('button', { name: 'Download flow package' }).click();
const file = await download;
if (file.suggestedFilename() !== 'PurchaseRequests_Flow_Test.zip') throw new Error(`Unexpected package name ${file.suggestedFilename()}`);
await p.getByText('downloaded.').waitFor();
await shot(p, '24-admin-flow-package');
await p.close();

// An employee on a site that is not set up yet.
p = await open('jane', '#/', 1440, 900, 'setup=new');
if (!(await p.getByText('Purchase Requests is not set up on this site yet').isVisible())) throw new Error('Employee should see the not-set-up message');
await p.close();

await p.close();

await browser.close();
if (problems.length) {
  console.log('\nBrowser problems:\n' + problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nNo browser errors.');
}
