// Captures the prototype screens into docs/prototype/ for review, and checks the
// behaviour that matters in a real browser: the defaults, the quote rule, the
// receipt reader, and the whole approval path (Jane sends a request, Max
// approves it, Jane attaches her receipts and submits it, Max processes it).
// The browser's clock is fixed at 2026-10-12, the day the sample data is set
// on, so the screenshots and the "dated before today" checks do not depend on
// the day the script is run.
// Start the preview first (npm run preview), then: node preview/tools/screenshots.mjs
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:5173/';
const outDir = fileURLToPath(new URL('../../../docs/prototype/', import.meta.url));
const fixtures = fileURLToPath(new URL('../../../test/fixtures/receipts/', import.meta.url));
const fixture = (name) => fixtures + name;
const TODAY = new Date('2026-10-12T09:00:00');
mkdirSync(outDir, { recursive: true });
// Start from nothing, so a screenshot that is no longer taken does not stay behind.
for (const f of readdirSync(outDir)) if (f.endsWith('.png')) unlinkSync(outDir + f);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const problems = [];

/** A check that does not stop the run: every failure is reported at the end. */
function check(ok, message, details = '') {
  console.log(`${ok ? 'ok   ' : 'FAIL '}${message}`);
  if (!ok) problems.push(`${message}${details ? `: ${details}` : ''}`);
}

/**
 * Opens a page as one of the sample people. Every page is its own browser
 * context, so it starts with its own copy of the sample data and its own
 * session storage; `goTo` keeps the data between people within one page.
 */
async function open(user, hash, width = 1440, height = 900, extra = '') {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.clock.setFixedTime(TODAY);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('console', (m) => m.type() === 'error' && problems.push(`${user} ${hash}: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${user} ${hash}: ${e.message}`));
  await page.goto(`${BASE}?user=${user}&shot=1${extra ? `&${extra}` : ''}${hash}`);
  await page.waitForSelector('.ctx-main');
  await page.waitForTimeout(700);
  return page;
}

/**
 * Opens a page for a check that depends on timing (saving, reading back), on
 * the real clock: a fixed clock changes the order of timers. The preview's
 * writes to its sample data are counted in window.__storeWrites.
 */
async function openLive(user, hash, width = 1440, height = 900) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => {
    window.__storeWrites = 0;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'purchase-requests-preview-store') window.__storeWrites += 1;
      return setItem.call(this, key, value);
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('console', (m) => m.type() === 'error' && problems.push(`${user} ${hash}: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${user} ${hash}: ${e.message}`));
  await page.goto(`${BASE}?user=${user}&shot=1${hash}`);
  await page.waitForSelector('.ctx-main');
  await page.waitForTimeout(700);
  return page;
}

/** The rows of a request as the preview has stored them. */
async function storedLines(page, requestId) {
  const store = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('purchase-requests-preview-store')));
  return store.lines.filter((l) => l.requestId === requestId).sort((a, b) => a.rowNumber - b.rowNumber);
}

/** Pastes text into a cell as a spreadsheet puts it on the clipboard. */
async function paste(locator, text) {
  await locator.focus();
  await locator.evaluate((el, value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
}

/** Goes to another address in the same page, so the sample data kept in the session carries over. */
async function goTo(page, user, hash) {
  await page.goto(`${BASE}?user=${user}&shot=1${hash}`);
  await page.waitForSelector('.ctx-main');
  await page.waitForTimeout(700);
}

async function shot(page, name, fullPage = true) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage });
  console.log('saved', name);
}

const exact = { exact: true };
const header = (page) => page.locator('.ctx-header');

try {
  // ---- Employee: the home page and a new request -------------------------------

  let p = await open('jane', '#/');
  await shot(p, '01-my-requests');
  await p.getByRole('button', { name: 'New request' }).click();
  await p.getByText('New purchase request').first().waitFor();
  await shot(p, '02-new-request-details');

  // The defaults, and the quote rule, in a real browser (travel D-057; P-015, P-023).
  await p.getByLabel('Business purpose', exact).fill('Assay supplies');
  await p.getByRole('button', { name: 'Next: Purchases' }).click();
  await p.getByRole('button', { name: 'Add purchase without a file' }).click();
  const firstRowPaid = await p.getByLabel('Row 1 who paid', exact).inputValue();
  check(firstRowPaid === 'company', 'The first row Who paid defaults to Company', firstRowPaid);
  await p.getByLabel('Row 1 vendor', exact).fill('Acme Lab Supply');
  await p.waitForTimeout(300);
  const rememberedCategory = await p.getByLabel('Row 1 category', exact).inputValue();
  check(rememberedCategory === 'rdMaterials', 'The category comes from the vendor used before', rememberedCategory);
  await p.getByLabel('Row 1 date', exact).fill('2026-10-14');
  await p.getByLabel('Row 1 what was bought and why', exact).fill('Pipette tips and centrifuge tubes');
  await p.getByLabel('Row 1 amount', exact).fill('640');
  await p.waitForTimeout(300);
  check(
    await p.getByText('Attach a quote, or say why there is none.').first().isVisible(),
    'The quote rule message shows for a $640 vendor total with no quote'
  );
  check(await p.getByLabel('Row 1 reason there is no quote', exact).isVisible(), 'The "No quote: say why" box shows on the first row of that vendor');
  check((await p.getByLabel('Row 1 reason there is no receipt', exact).count()) === 0, 'The "No receipt: say why" box waits until approval is done');
  await p.getByRole('button', { name: 'Add purchase without a file' }).click();
  await p.getByLabel('Row 2 who paid', exact).selectOption('employee');
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: 'Add purchase without a file' }).click();
  const thirdRowPaid = await p.getByLabel('Row 3 who paid', exact).inputValue();
  check(thirdRowPaid === 'employee', 'A new row copies Who paid from the row above', thirdRowPaid);
  // A quote dropped with the switch on Quotes becomes a row with a quote file, and is not read (P-021).
  await p.getByRole('radio', { name: 'Quotes' }).click();
  await p.locator('input[type=file][multiple]').setInputFiles(fixture('harbor-software-quote.pdf'));
  await p.getByText('1 quote added as a new row.').waitFor();
  await p.waitForTimeout(1500);
  check((await p.locator('.ctx-receipt-chip.quote').count()) === 1, 'A dropped quote is attached to its row as a quote');
  check((await p.getByLabel('Row 4 vendor', exact).inputValue()) === '', 'A quote is not read for suggestions');
  await p.close();

  // ---- Employee: the purchases step ----------------------------------------------

  // A typical laptop screen (1440 wide): the grid takes the full width; the files slide over.
  p = await open('jane', '#/request/41/purchases');
  check(await p.getByText('Needed').first().isVisible(), 'Vendor totals show that the $640 vendor needs approval');
  check(await p.getByText('Attached').first().isVisible(), 'Vendor totals show that the quote is attached');
  await shot(p, '03-purchases-laptop');
  // Attach a receipt from the row menu, then open it: it slides in from the right.
  await p.getByLabel('Row 2 menu', exact).click();
  await p.locator('.ctx-menu input[type=file]').first().setInputFiles(fixture('northwind-office-receipt.png'));
  await p.getByRole('button', { name: /northwind-office-receipt/ }).click();
  await p.getByRole('dialog', { name: 'Files' }).waitFor();
  await p.waitForTimeout(500);
  await shot(p, '04-purchases-receipt-slide-over', false);
  await p.keyboard.press('Escape');
  await p.getByLabel('Row 1 menu', exact).click();
  check(await p.getByRole('menuitem', { name: 'Attach a quote' }).isVisible(), 'The row menu offers "Attach a quote"');
  await shot(p, '05-purchases-row-menu', false);
  await p.close();

  // A wide screen (1920): the files sit beside the grid.
  p = await open('jane', '#/request/41/purchases', 1920, 1080);
  await p.getByLabel('Row 2 menu', exact).click();
  await p.locator('.ctx-menu input[type=file]').first().setInputFiles(fixture('northwind-office-receipt.png'));
  await p.getByRole('button', { name: /northwind-office-receipt/ }).waitFor();
  await p.getByLabel('Row 2 vendor', exact).click();
  await p.waitForTimeout(500);
  await shot(p, '06-purchases-wide-screen');
  await p.close();

  // Receipt suggestions (travel D-074, D-078): three receipts dropped on a new request are
  // read in the browser, and what the app filled in is marked until it is confirmed.
  p = await open('jane', '#/');
  await p.getByRole('button', { name: 'New request' }).click();
  await p.getByRole('button', { name: 'Next: Purchases' }).click();
  await p
    .locator('input[type=file][multiple]')
    .setInputFiles(['northwind-office-receipt.png', 'quickship-postage-receipt.png', 'summit-training-receipt.pdf'].map(fixture));
  await p.getByText('Suggestions filled in on 3 rows').waitFor({ timeout: 90000 });
  const rowValues = async (n) => ({
    vendor: await p.getByLabel(`Row ${n} vendor`, exact).inputValue(),
    amount: await p.getByLabel(`Row ${n} amount`, exact).inputValue(),
    date: await p.getByLabel(`Row ${n} date`, exact).inputValue()
  });
  const [northwind, quickship, summit] = [await rowValues(1), await rowValues(2), await rowValues(3)];
  const suggestedCells = await p.locator('.ctx-cell.suggested').count();
  check(
    northwind.vendor === 'Northwind Office Supply' && northwind.amount === '86.45' && northwind.date === '2026-10-07',
    'The reader fills in the Northwind receipt',
    JSON.stringify(northwind)
  );
  check(
    quickship.vendor === 'QuickShip Postage' && quickship.amount === '24.60' && quickship.date === '2026-10-08',
    'The reader fills in the QuickShip receipt',
    JSON.stringify(quickship)
  );
  check(
    summit.vendor === 'Summit Training Institute' && summit.amount === '450.00' && summit.date === '2026-10-05',
    'The reader fills in the Summit receipt',
    JSON.stringify(summit)
  );
  check(suggestedCells >= 9, 'What the reader filled in is marked as suggested', String(suggestedCells));
  await p.mouse.move(0, 0);
  await shot(p, '07-purchases-receipt-suggestions', false);
  await p.close();

  // ---- Employee: review, send for approval --------------------------------------

  // Sam's PR-0033 was returned at approval: a $900 vendor total has no quote and no reason,
  // and the purchase is dated before today, so it looks already bought (P-017).
  p = await open('sam', '#/request/33/review');
  check(await p.getByRole('heading', { name: 'Before you send' }).isVisible(), 'Review is checking the request for sending, not for submitting');
  check(await p.getByRole('button', { name: 'Send for approval', exact: true }).isDisabled(), 'Send for approval is disabled while a problem is open');
  await shot(p, '08-review-with-problems');
  await p.getByRole('button', { name: 'Fix' }).first().click();
  await p.getByLabel('Row 2 reason there is no quote', exact).fill('The supplier does not give quotes');
  await p.waitForTimeout(800);
  await p.getByRole('button', { name: 'Next: Review' }).click();
  await p.getByText('Check these. You can still send the request for approval:').waitFor();
  check(await p.getByRole('button', { name: 'Send for approval', exact: true }).isEnabled(), 'Send for approval is enabled once the quote reason is given');
  await shot(p, '09-review-ready-to-send');
  await p.getByRole('button', { name: 'Send for approval', exact: true }).click();
  const flagged = p.getByRole('dialog');
  check(await flagged.getByText('Redwood Fabrication').isVisible(), 'The send dialog lists the vendor total that needs approval');
  check(
    await flagged.getByText('This looks already bought. It will be flagged Bought before approval. You can still send it.').isVisible(),
    'The send dialog says a purchase dated before today looks already bought'
  );
  await shot(p, '10-send-dialog-bought-before-approval', false);
  await p.close();

  p = await open('jane', '#/request/41/purchases?panel=instructions');
  await shot(p, '11-instructions', false);
  await p.close();

  p = await open('sam', '#/');
  check(
    (await p.getByText('was returned to you by the approver.').count()) === 1 && (await p.getByText('was returned to you by the administrator.').count()) === 1,
    'Each returned request says who returned it'
  );
  await shot(p, '12-returned-requests');
  await p.close();

  // ---- The approval path, in one page, with the sample data kept between people ---

  p = await open('jane', '#/request/41/review', 1440, 900, 'reset=1');
  await p.getByRole('button', { name: 'Send for approval', exact: true }).click();
  const plain = p.getByRole('dialog');
  check((await plain.getByText('This looks already bought').count()) === 0, 'A purchase dated after today is not flagged as bought');
  await shot(p, '13-send-for-approval-dialog', false);
  await plain.getByRole('button', { name: 'Send for approval', exact: true }).click();
  await p.getByText('Sent for approval. The approver has been emailed.').waitFor();
  await header(p).getByText('Awaiting approval', exact).waitFor();
  check(true, 'Jane sent PR-0041 for approval: Awaiting approval');
  check((await p.getByRole('button', { name: 'Send for approval', exact: true }).count()) === 0, 'A request awaiting approval has no Send button');

  await goTo(p, 'admin', '#/admin/approvals');
  check(await p.getByRole('row', { name: /PR-0041/ }).isVisible(), 'Max sees PR-0041 under Approvals');
  await shot(p, '14-admin-approvals');
  await p.getByRole('row', { name: /PR-0041/ }).click();
  await header(p).getByText('PR-0041').waitFor();
  await p.getByLabel('Row 2 category', exact).selectOption('rdMaterials');
  await p.getByRole('button', { name: 'Approve', exact: true }).click();
  const approveDialog = p.getByRole('dialog');
  check(await approveDialog.getByText('You changed 1 category.').isVisible(), 'The approve dialog counts the categories changed');
  await approveDialog.getByLabel('Note for the employee (optional)').fill('OK, go ahead.');
  await approveDialog.getByRole('button', { name: 'Approve request' }).click();
  await p.getByText('PR-0041 approved.').waitFor();
  await header(p).getByText('Approved', exact).waitFor();
  check(true, 'Max approved PR-0041, with a changed category: Approved');

  await goTo(p, 'jane', '#/request/41/purchases');
  check(await p.getByText('Approved by Max Wamsley').isVisible(), 'Jane sees who approved it');
  check(await p.getByText('OK, go ahead.').isVisible(), 'Jane sees the approver note');
  await shot(p, '15-approved-request');
  // After the approval she buys, then attaches her receipts and invoices from the row menu.
  await p.getByLabel('Row 1 menu', exact).click();
  await p.locator('.ctx-menu input[type=file]').first().setInputFiles(fixture('acme-lab-supply-invoice.pdf'));
  await p.getByRole('button', { name: /acme-lab-supply-invoice/ }).waitFor();
  await p.getByLabel('Row 2 menu', exact).click();
  await p.locator('.ctx-menu input[type=file]').first().setInputFiles(fixture('northwind-office-receipt.png'));
  await p.getByRole('button', { name: /northwind-office-receipt/ }).waitFor();
  await p.getByRole('button', { name: 'Next: Review' }).click();
  await p.getByText('Everything is complete. You can submit.').waitFor();
  await p.getByRole('button', { name: 'Submit request', exact: true }).click();
  const submitDialog = p.getByRole('dialog');
  const submitButton = submitDialog.getByRole('button', { name: 'Submit request', exact: true });
  check(await submitButton.isDisabled(), 'Submit stays disabled until the certification is ticked');
  await submitDialog.getByRole('checkbox').check();
  check(await submitButton.isEnabled(), 'Submit is enabled once the certification is ticked');
  await shot(p, '16-submit-dialog', false);
  await submitButton.click();
  await p.getByText('Request submitted. The administrator has been notified.').waitFor();
  await header(p).getByText('Submitted', exact).waitFor();
  check(true, 'Jane submitted PR-0041: Submitted');
  await p.waitForTimeout(3600);
  await shot(p, '17-submitted');

  await goTo(p, 'admin', '#/admin/process');
  check(await p.getByRole('row', { name: /PR-0041/ }).isVisible(), 'Max sees PR-0041 under Requests to process');
  await shot(p, '18-admin-requests-to-process');
  await p.getByRole('row', { name: /PR-0041/ }).click();
  await header(p).getByText('PR-0041').waitFor();
  await p.getByRole('button', { name: 'Mark processed' }).click();
  await p.getByText('PR-0041 marked processed.').waitFor();
  await header(p).getByText('Processed', exact).waitFor();
  check(true, 'Max marked PR-0041 processed: Processed');
  await shot(p, '19-admin-request-processed');
  await p.close();

  // ---- Administrator ------------------------------------------------------------

  p = await open('admin', '#/admin/request/40');
  await shot(p, '20-admin-request-awaiting-approval');
  await p.getByLabel('Row 2 category', exact).selectOption('computer');
  await p.getByRole('button', { name: 'Approve', exact: true }).click();
  await p.getByLabel('Note for the employee (optional)').fill('OK, use the company card.');
  await shot(p, '21-admin-approve-dialog', false);
  await p.keyboard.press('Escape');
  await p.getByRole('button', { name: 'Return with a note' }).click();
  await p.getByLabel('What needs correcting? The employee sees this note.').fill('Please add a second quote for the software license.');
  await shot(p, '22-admin-return-dialog', false);
  await p.keyboard.press('Escape');
  await p.getByRole('tab', { name: 'Approval email' }).click();
  check(await p.getByText('Needs your approval').isVisible(), 'The approval email shows what needs approval');
  await shot(p, '23-admin-approval-email');
  await p.close();

  p = await open('admin', '#/admin/request/37');
  check(await p.getByText('Bought before approval:').first().isVisible(), 'A request bought before approval is flagged for the administrator');
  await p.getByRole('tab', { name: 'Submission email' }).click();
  await shot(p, '24-admin-submission-email');
  await p.getByRole('tab', { name: 'CSV file' }).click();
  await shot(p, '25-admin-csv');
  await p.getByRole('tab', { name: 'Folder contents' }).click();
  await shot(p, '26-admin-folder-contents');
  await p.close();

  p = await open('admin', '#/admin/attention');
  check(
    (await p.getByText('Approval email failed').count()) > 0 && (await p.getByText('Packaging failed').count()) > 0,
    'Needs attention lists a failed approval email and a failed package'
  );
  check(await p.getByText('Same file').isVisible(), 'Needs attention lists the duplicate between two employees');
  await shot(p, '27-admin-needs-attention');
  await p.close();

  p = await open('admin', '#/admin/request/35');
  await shot(p, '28-admin-failed-package');
  await p.close();

  p = await open('admin', '#/admin/all');
  await shot(p, '29-admin-all-requests');
  await p.close();

  // A new site: the administrator sees only Set-up until the lists exist (travel D-063).
  p = await open('admin', '#/admin/process', 1440, 900, 'setup=new');
  await shot(p, '30-admin-setup-new-site');
  await p.getByRole('button', { name: 'Create the lists' }).click();
  await p.getByText('The lists are ready.').waitFor();
  await shot(p, '31-admin-setup-done');
  // Step 2: the flow package for the test site (travel D-047).
  const download = p.waitForEvent('download');
  await p.getByRole('button', { name: 'Download flow package' }).click();
  const file = await download;
  check(file.suggestedFilename() === 'PurchaseRequests_Flow_Test.zip', 'The test flow package has its name', file.suggestedFilename());
  await p.getByText('downloaded.').waitFor();
  check(await p.getByText(/Approval emails go to/).isVisible(), 'Set-up says where the approval emails go');
  // The earlier message ("The lists are ready.") would sit over the card in the picture: wait for it to go.
  await p
    .locator('.ctx-toast')
    .first()
    .waitFor({ state: 'detached', timeout: 15000 })
    .catch(() => undefined);
  await shot(p, '32-admin-flow-package');
  await p.close();

  // An employee on a site that is not set up yet.
  p = await open('jane', '#/', 1440, 900, 'setup=new');
  check(await p.getByText('Purchase Requests is not set up on this site yet').isVisible(), 'An employee on a new site sees the not-set-up message');
  await shot(p, '33-employee-site-not-set-up', false);
  await p.close();

  // ---- Regression checks, no screenshots ------------------------------------------

  // What is typed while a row is added shows on screen and is what is saved.
  p = await openLive('jane', '#/request/41/purchases');
  await p.getByRole('button', { name: 'Add purchase without a file' }).click();
  await p.waitForTimeout(150);
  await p.getByLabel('Row 2 amount', exact).fill('123.45');
  await p.waitForTimeout(1600);
  await p.locator('.ctx-page-title').click();
  const typedLines = await storedLines(p, 41);
  const storedTotal = typedLines.reduce((sum, l) => sum + (l.amountCents ?? 0), 0);
  const shownTotal = await p.locator('.ctx-metric').filter({ hasText: 'Request total' }).locator('.ctx-metric-value').innerText();
  check(
    (await p.getByLabel('Row 2 amount', exact).inputValue()) === '123.45' && typedLines[1].amountCents === 12345 && typedLines.length === 3,
    'An amount typed while a row is added shows on screen and is saved'
  );
  check(shownTotal.trim() === `$${(storedTotal / 100).toFixed(2)}`, 'The request total on screen matches what is saved', `${shownTotal} / ${storedTotal}`);
  // Saving waits for a pause in typing: 30 characters typed one by one are written once or twice.
  await p.getByLabel('Row 2 what was bought and why', exact).click();
  await p.keyboard.press('Control+A');
  await p.keyboard.press('Delete');
  await p.waitForTimeout(1200);
  const writesBefore = await p.evaluate(() => window.__storeWrites);
  await p.keyboard.type('Thirty characters typed slowly', { delay: 80 });
  await p.waitForTimeout(1500);
  const writes = (await p.evaluate(() => window.__storeWrites)) - writesBefore;
  check(writes <= 2, 'Typing 30 characters saves at most twice, not on every keystroke', `${writes} writes`);
  await p.close();

  // Pasting rows from a spreadsheet: quoted cells, dates, rows that do not fit, cells that cannot be used.
  p = await openLive('jane', '#/request/41/purchases');
  await paste(
    p.getByLabel('Row 1 date', exact),
    '10/15/2026\tAcme Lab Supply\t"Tips,\r\n""sterile"" pack"\tR&D Materials & Supplies / Equipment\t$1,234.5\tCompany\r\n' +
      '14/10/2026\tNorthwind Office Supply\tLabels\tStationery\t12,50\tEmployee\r\n' +
      '2026-10-17\tQuickShip Postage\tPostage\tShipping/Postage\t24.60\tCompany\r\n'
  );
  await p.waitForTimeout(1500);
  const pasted = await storedLines(p, 41);
  check(
    pasted[0].date === '2026-10-15' && pasted[0].description === 'Tips, "sterile" pack' && pasted[0].amountCents === 123450,
    'A pasted row is read: a US date, a quoted cell with a line break, an amount',
    JSON.stringify([pasted[0].date, pasted[0].description, pasted[0].amountCents])
  );
  check(pasted[1].date === '2026-10-14' && pasted[1].amountCents === null, 'A pasted date that cannot be read is not used; a bad amount empties the amount');
  const pasteToasts = (await p.locator('.ctx-toast').allInnerTexts()).join(' ');
  check(
    pasteToasts.includes('1 row was not pasted') && pasteToasts.includes('3 cells were not pasted'),
    'One warning says which rows and cells were not pasted, and why',
    pasteToasts
  );
  // A date box takes no year outside the app's range: the date is emptied and the cell says why.
  await p.getByLabel('Row 2 date', exact).fill('0026-10-14');
  await p.getByLabel('Row 2 vendor', exact).click();
  await p.waitForTimeout(1200);
  check(
    (await storedLines(p, 41))[1].date === '' && (await p.getByText('Enter a date between 2000 and 2099').count()) > 0,
    'A date with a year like 0026 is not saved, and the cell says why'
  );
  await p.close();

  // The keyboard: dialogs take the focus and give it back, the row menu closes on Escape, list rows open with Enter.
  p = await openLive('jane', '#/request/41/review');
  await p.getByRole('button', { name: 'Send for approval', exact: true }).focus();
  await p.keyboard.press('Enter');
  await p.getByRole('dialog', { name: 'Send PR-0041 for approval?' }).waitFor();
  const inDialog = () => p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  let kept = await inDialog();
  for (let i = 0; i < 4; i++) {
    await p.keyboard.press('Tab');
    kept = kept && (await inDialog());
  }
  check(kept, 'A dialog takes the focus and keeps Tab inside it');
  await p.keyboard.press('Escape');
  check(
    await p.evaluate(() => document.activeElement?.textContent?.trim() === 'Send for approval' && !document.activeElement.closest('[role="dialog"]')),
    'Escape closes the dialog and the focus returns to the button that opened it'
  );
  await goTo(p, 'jane', '#/request/41/purchases');
  await p.getByLabel('Row 1 menu', exact).focus();
  await p.keyboard.press('Enter');
  await p.getByRole('menu').waitFor();
  await p.keyboard.press('Escape');
  check(
    (await p.getByRole('menu').count()) === 0 && (await p.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Row 1 menu',
    'Escape closes the row menu and the focus returns to its button'
  );
  await goTo(p, 'admin', '#/admin/approvals');
  await p.getByRole('row', { name: 'Open PR-0040' }).focus();
  await p.keyboard.press('Enter');
  await header(p).getByText('PR-0040').waitFor();
  check(true, 'A row of the Approvals list opens with Enter');
  // The approver opens the quote the approval rests on.
  await p.getByRole('button', { name: 'Quote harbor-software-quote.pdf' }).click();
  await p.getByRole('dialog', { name: 'Files' }).locator('iframe[title="Quote harbor-software-quote.pdf"]').waitFor();
  check(true, 'The approver opens the Harbor quote of PR-0040 in the preview');
  await p.keyboard.press('Escape');
  await p.close();

  // Laptop and phone widths: no sideways scrolling of the page, and nothing outside its card.
  for (const [width, user, hash] of [
    [1024, 'admin', '#/admin/process'],
    [1024, 'admin', '#/admin/request/40'],
    [1024, 'jane', '#/'],
    [375, 'jane', '#/request/41/purchases'],
    [375, 'admin', '#/admin/request/37'],
    [375, 'sam', '#/request/33/review']
  ]) {
    p = await openLive(user, hash, width, 800);
    const layout = await p.evaluate(() => ({
      sideways: document.documentElement.scrollWidth - window.innerWidth,
      outside: Array.from(document.querySelectorAll('.ctx-main .ctx-card, .ctx-main .ctx-header, .ctx-main .ctx-banner, .ctx-main .ctx-drop'))
        .filter((box) => box.scrollWidth > box.clientWidth + 1)
        .map((box) => box.className)
    }));
    check(layout.sideways <= 0 && layout.outside.length === 0, `At ${width} wide, ${hash} fits its cards`, JSON.stringify(layout));
    await p.close();
  }
} catch (e) {
  problems.push(`The run stopped early: ${e instanceof Error ? e.message : String(e)}`);
}

await browser.close();
if (problems.length) {
  console.log('\nBrowser problems:\n' + problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nNo browser errors.');
}
