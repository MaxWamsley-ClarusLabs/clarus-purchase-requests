// The SharePoint data service against an in-memory fake of SharePoint's REST
// interface (src/testing/FakeSharePoint.ts). Real SharePoint behaviour is
// confirmed on the test site at Stage 8.

import { messages } from '../../domain/messages';
import { FakeSharePoint, FakeUser } from '../../testing/FakeSharePoint';
import { SpClient } from './http';
import { NotAllowedError, SharePointDataService, hasPermission, uniqueName } from './SharePointDataService';

const MAX: FakeUser = { id: 1, title: 'Max Wamsley', email: 'max@example.com', admin: true };
const JANE: FakeUser = { id: 7, title: 'Jane Doe', email: 'Jane.Doe@example.com', admin: false };
const SAM: FakeUser = { id: 8, title: 'Sam Lee', email: 'sam.lee@example.com', admin: false };

function serviceFor(site: FakeSharePoint, user: FakeUser, now = new Date(2026, 9, 16, 9, 30)): SharePointDataService {
  const client = new SpClient(site.fetchAs(user), site.webUrl, site.webPath, async () => undefined);
  return new SharePointDataService(client, () => now);
}

function file(name: string, content = `synthetic ${name}`): File {
  return new File([content], name, { type: name.endsWith('.pdf') ? 'application/pdf' : 'image/png' });
}

async function setUpSite(): Promise<FakeSharePoint> {
  const site = new FakeSharePoint();
  await serviceFor(site, MAX).runSetup(() => undefined);
  return site;
}

/** Jane fills in a complete report with two receipts and returns its ID. */
async function janeReport(site: FakeSharePoint): Promise<number> {
  const jane = serviceFor(site, JANE);
  const report = await jane.createReport();
  await jane.updateReport(report.id, {
    tripName: 'Boston Conference',
    destination: 'Boston, MA',
    businessPurpose: 'Present results',
    tripPurpose: 'nsfPhase1',
    tripStart: '2026-10-12',
    tripEnd: '2026-10-15'
  });
  const lines = await jane.addLinesFromFiles(report.id, [file('ticket.pdf'), file('hotel.png')]);
  await jane.updateLine(lines[0].id, { date: '2026-10-12', vendor: 'Skyway Airlines', category: 'airfare', amountCents: 45230, paymentType: 'personal' });
  await jane.updateLine(lines[1].id, { date: '2026-10-13', vendor: 'Harbor View Hotel', category: 'lodging', amountCents: 61224 });
  return report.id;
}

describe('SharePoint permissions', () => {
  it('reads SharePoint permission masks, including values above 2^31', () => {
    expect(hasPermission({ High: '2147483647', Low: '4294967295' }, 31)).toBe(true);
    expect(hasPermission({ High: '432', Low: '1011028719' }, 31)).toBe(false);
    expect(hasPermission({ High: 0, Low: 1 }, 1)).toBe(true);
  });

  it('keeps receipt names unique on a row', () => {
    expect(uniqueName('receipt.pdf', new Set())).toBe('receipt.pdf');
    expect(uniqueName('receipt.pdf', new Set(['receipt.pdf', 'receipt (2).pdf']))).toBe('receipt (3).pdf');
  });
});

describe('Site set-up (D-063)', () => {
  it('creates the three lists with their columns, own-items permissions and version history', async () => {
    const site = new FakeSharePoint();
    const admin = serviceFor(site, MAX);
    expect((await admin.getSetupStatus()).ready).toBe(false);
    const steps: string[] = [];
    const status = await admin.runSetup((s) => steps.push(s));
    expect(status.ready).toBe(true);
    expect(status.lists.map((l) => l.title)).toEqual(['Travel Reports', 'Travel Expense Lines', 'Travel Submissions']);
    expect(status.lists.map((l) => l.address)).toEqual(['Lists/TravelReports', 'Lists/TravelExpenseLines', 'Lists/TravelSubmissions']);
    expect(status.lists.every((l) => l.ownItemsOnly && l.versioning && l.attachments && l.listId)).toBe(true);
    expect(steps[0]).toBe('Creating the Travel Reports list');
    expect(site.listByUrlName('TravelReports')!.info.Title).toBe('Travel Reports');
    expect(site.listByUrlName('TravelReports')!.fields.find((f) => f.InternalName === 'Author')!.Indexed).toBe(true);
  });

  it('only adds what is missing when run again, and never removes anything', async () => {
    const site = await setUpSite();
    const reports = site.listByUrlName('TravelReports')!;
    reports.fields = reports.fields.filter((f) => f.InternalName !== 'ReturnNote');
    const before = site.log.length;
    const admin = serviceFor(site, MAX);
    const check = await admin.getSetupStatus();
    expect(check.ready).toBe(false);
    expect(check.lists[0].missingFields).toEqual(['ReturnNote']);
    await admin.runSetup(() => undefined);
    expect((await admin.getSetupStatus()).ready).toBe(true);
    const creates = site.log.slice(before).filter((r) => r.url.endsWith('/_api/web/lists'));
    expect(creates).toEqual([]);
  });

  it('is not ready if the own-items permission could not be set, so the page can show the manual steps', async () => {
    const site = new FakeSharePoint();
    site.refuseItemLevelPermissions = true;
    const status = await serviceFor(site, MAX).runSetup(() => undefined);
    expect(status.ready).toBe(false);
    expect(status.lists.every((l) => !l.ownItemsOnly)).toBe(true);
  });

  it('is for administrators only', async () => {
    const site = new FakeSharePoint();
    await expect(serviceFor(site, JANE).runSetup(() => undefined)).rejects.toBeInstanceOf(NotAllowedError);
  });

  it('leaves alone a list at its address that another app made (D-077)', async () => {
    const site = new FakeSharePoint();
    const other = site.addOtherList('TravelSubmissions', ['Status']);
    const steps: string[] = [];
    const status = await serviceFor(site, MAX).runSetup((s) => steps.push(s));
    expect(status.ready).toBe(false);
    const check = status.lists.find((l) => l.key === 'submissions')!;
    expect(check.notOurs).toBe(true);
    expect(steps).toContain('Left Lists/TravelSubmissions unchanged: that list was not made by this app');
    // The other list keeps its own columns and settings.
    expect(other.fields.map((f) => f.InternalName)).not.toContain('SubmissionNumber');
    expect(other.info.ReadSecurity).toBe(1);
    expect(other.info.EnableVersioning).toBe(false);
    // The two lists that were free are created as usual.
    expect(status.lists.filter((l) => l.key !== 'submissions').every((l) => l.exists && !l.notOurs && l.ownItemsOnly)).toBe(true);
    await expect(serviceFor(site, MAX).getFlowSettings('test', 'https://contoso.sharepoint.com/sites/Travel/SitePages/Travel.aspx')).rejects.toThrow();
  });

  it('still treats its own list as its own when the description was edited', async () => {
    const site = await setUpSite();
    site.listByUrlName('TravelReports')!.info.Description = 'Edited by an owner';
    const status = await serviceFor(site, MAX).getSetupStatus();
    expect(status.ready).toBe(true);
    expect(status.lists.every((l) => !l.notOurs)).toBe(true);
  });
});

describe('SharePointDataService, employee', () => {
  it('knows who is signed in and whether they are an administrator', async () => {
    const site = await setUpSite();
    expect(await serviceFor(site, JANE).getCurrentUser()).toEqual({ displayName: 'Jane Doe', email: 'jane.doe@example.com', isAdministrator: false });
    expect((await serviceFor(site, MAX).getCurrentUser()).isAdministrator).toBe(true);
  });

  it('creates a numbered report, saves rows with their receipts, and keeps totals', async () => {
    const site = await setUpSite();
    const id = await janeReport(site);
    const { report, lines } = await serviceFor(site, JANE).getReport(id);
    expect(report.reportNumber).toBe('TR-0001');
    expect(report.ownerEmail).toBe('jane.doe@example.com');
    expect(report.tripPurpose).toBe('nsfPhase1');
    expect(lines.map((l) => l.rowNumber)).toEqual([1, 2]);
    expect(lines[0].receipts.map((r) => r.fileName)).toEqual(['ticket.pdf']);
    expect(lines[0].receipts[0].fingerprint).toMatch(/^[0-9a-f]{64}$/);
    // The first row starts as Company card; Jane changed it to personal. The second copies the row above at creation.
    expect(lines[1].paymentType).toBe('companyCard');
    expect(report.totalReimburseCents).toBe(45230);
    expect(report.totalTripCents).toBe(106454);
    expect(site.listByUrlName('TravelExpenseLines')!.items.get(1)!.fields.Amount).toBe(452.3);
  });

  it('saves mileage and counts it in the stored totals (D-071)', async () => {
    const site = await setUpSite();
    const id = await janeReport(site);
    const jane = serviceFor(site, JANE);
    const trips = [{ id: 't1', date: '2026-10-12', from: 'Office', to: 'Airport', miles: 42 }];
    await jane.updateReport(id, { hasMileage: true, mileageTrips: trips });
    const { report } = await jane.getReport(id);
    expect(report.hasMileage).toBe(true);
    expect(report.mileageTrips).toEqual(trips);
    expect(report.totalReimburseCents).toBe(45230 + 3192);
    await jane.updateReport(id, { hasMileage: false });
    expect((await jane.getReport(id)).report.totalReimburseCents).toBe(45230);
  });

  it('shows employees only their own reports (D-003)', async () => {
    const site = await setUpSite();
    const id = await janeReport(site);
    const sam = serviceFor(site, SAM);
    await sam.createReport();
    expect((await sam.listMyReports()).map((r) => r.ownerEmail)).toEqual(['sam.lee@example.com']);
    await expect(sam.getReport(id)).rejects.toBeInstanceOf(NotAllowedError);
    expect((await serviceFor(site, MAX).listAllReports()).length).toBe(2);
  });

  it('renumbers rows after a deletion and keeps shared-receipt pointers right', async () => {
    const site = await setUpSite();
    const jane = serviceFor(site, JANE);
    const report = await jane.createReport();
    const [a, b, c] = await jane.addLinesFromFiles(report.id, [file('a.pdf'), file('b.pdf'), file('c.pdf')]);
    await jane.updateLine(c.id, { sameReceiptAsRow: 2 });
    await jane.deleteLine(a.id);
    const lines = (await jane.getReport(report.id)).lines;
    expect(lines.map((l) => [l.id, l.rowNumber, l.sameReceiptAsRow])).toEqual([
      [b.id, 1, null],
      [c.id, 2, 1]
    ]);
  });

  it('adds a second file with a unique name and removes files', async () => {
    const site = await setUpSite();
    const jane = serviceFor(site, JANE);
    const report = await jane.createReport();
    const [line] = await jane.addLinesFromFiles(report.id, [file('receipt.pdf')]);
    const two = await jane.addFileToLine(line.id, file('receipt.pdf', 'the card slip'));
    expect(two.receipts.map((r) => r.fileName)).toEqual(['receipt.pdf', 'receipt (2).pdf']);
    const one = await jane.removeFileFromLine(line.id, 'receipt.pdf');
    expect(one.receipts.map((r) => r.fileName)).toEqual(['receipt (2).pdf']);
    expect(one.receipts[0].fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('submits: package files attached, report locked, then handed to the flow', async () => {
    const site = await setUpSite();
    const id = await janeReport(site);
    const jane = serviceFor(site, JANE);
    const submission = await jane.submitReport(id, messages.certification);
    expect(submission.packageStatus).toBe('Ready');
    expect(submission.folderName).toBe('2026-10-12_Jane-Doe_Boston-Conference_TR-0001');
    expect(submission.packageFileNames.sort()).toEqual(['R01_ticket.pdf', 'R02_hotel.png', 'TR-0001_Expenses.csv']);
    expect(submission.submitterEmail).toBe('jane.doe@example.com');
    expect(submission.certificationText).toBe(messages.certification);

    const copy = site
      .listByUrlName('TravelSubmissions')!
      .items.get(1)!
      .attachments.find((x) => x.name === 'R01_ticket.pdf')!;
    expect(await copy.content.text()).toBe('synthetic ticket.pdf');
    // The stored file starts with the UTF-8 byte-order mark (D-045); reading it as text drops the mark.
    const stored = site
      .listByUrlName('TravelSubmissions')!
      .items.get(1)!
      .attachments.find((x) => x.name === 'TR-0001_Expenses.csv')!;
    expect(Array.from(new Uint8Array(await stored.content.arrayBuffer())).slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    const csv = await jane.getSubmissionCsv(submission.id);
    expect(csv).toContain('Jane Doe (jane.doe@example.com)');

    const { report } = await jane.getReport(id);
    expect(report.status).toBe('Submitted');
    expect(report.submissionCount).toBe(1);
    await expect(jane.updateReport(id, { tripName: 'Changed' })).rejects.toBeInstanceOf(NotAllowedError);
    await expect(jane.submitReport(id, messages.certification)).rejects.toBeInstanceOf(NotAllowedError);
  });

  it('stores unconfirmed suggestions and will not submit until they are confirmed (D-078)', async () => {
    const site = await setUpSite();
    const id = await janeReport(site);
    const jane = serviceFor(site, JANE);
    const { lines } = await jane.getReport(id);
    await jane.updateLine(lines[1].id, { paymentType: 'personal', suggested: ['paymentType', 'amount'] });
    expect(site.listByUrlName('TravelExpenseLines')!.items.get(2)!.fields.SuggestedFields).toBe('amount,paymentType');
    expect((await jane.getReport(id)).lines[1].suggested).toEqual(['amount', 'paymentType']);
    await expect(jane.submitReport(id, messages.certification)).rejects.toThrow();
    expect(site.listByUrlName('TravelSubmissions')!.items.size).toBe(0);
    await jane.updateLine(lines[1].id, { suggested: [] });
    expect((await jane.submitReport(id, messages.certification)).packageStatus).toBe('Ready');
  });

  it('refuses to submit without the certification', async () => {
    const site = await setUpSite();
    const id = await janeReport(site);
    await expect(serviceFor(site, JANE).submitReport(id, '')).rejects.toThrow(messages.certificationRequired);
    expect(site.listByUrlName('TravelSubmissions')!.items.size).toBe(0);
  });

  it('waits and tries again while SharePoint is busy', async () => {
    const site = await setUpSite();
    const jane = serviceFor(site, JANE);
    site.busyReplies = 2;
    const report = await jane.createReport();
    expect(report.reportNumber).toBe('TR-0001');
  });
});

describe('SharePointDataService, administrator', () => {
  it('returns, resubmits as R2, marks processed, and retries packaging', async () => {
    const site = await setUpSite();
    const id = await janeReport(site);
    const jane = serviceFor(site, JANE);
    const admin = serviceFor(site, MAX);
    const first = await jane.submitReport(id, messages.certification);

    await expect(jane.returnReport(id, 'No')).rejects.toBeInstanceOf(NotAllowedError);
    await admin.returnReport(id, 'Please attach the itemized hotel bill.');
    const returned = (await jane.getReport(id)).report;
    expect(returned.status).toBe('Returned');
    expect(returned.returnNote).toBe('Please attach the itemized hotel bill.');

    const second = await jane.submitReport(id, messages.certification);
    expect(second.submissionNumber).toBe(2);
    expect(second.previousFolderName).toBe(first.folderName);
    expect(second.folderName.endsWith('_R2')).toBe(true);
    expect((await admin.listSubmissions()).map((s) => s.reportNumber)).toEqual(['TR-0001', 'TR-0001']);

    site.listByUrlName('TravelSubmissions')!.items.get(second.id)!.fields.PackageStatus = 'Failed';
    expect((await admin.retryPackaging(second.id)).packageStatus).toBe('Ready');

    const processed = await admin.markProcessed(id);
    expect(processed.status).toBe('Processed');
    expect(processed.processedBy).toBe('Max Wamsley');
    expect(processed.processedOn).not.toBe('');
  });

  it('lists every row for cross-employee duplicate checks', async () => {
    const site = await setUpSite();
    await janeReport(site);
    const refs = await serviceFor(site, MAX).listAllLineRefs();
    expect(refs.map((r) => r.reportNumber)).toEqual(['TR-0001', 'TR-0001']);
    expect(refs[0].line.receipts[0].fingerprint).toMatch(/^[0-9a-f]{64}$/);
    await expect(serviceFor(site, JANE).listAllLineRefs()).rejects.toBeInstanceOf(NotAllowedError);
  });
});

describe('Flow package settings (D-047)', () => {
  const page = 'https://contoso.sharepoint.com/sites/Travel/SitePages/Travel-Expenses.aspx';

  it('reads the Travel Submissions list, the test library and the administrator for a test package', async () => {
    const site = await setUpSite();
    const config = await serviceFor(site, MAX).getFlowSettings('test', page);
    expect(config).toEqual({
      mode: 'test',
      travelSiteUrl: site.webUrl,
      submissionsListId: site.listByUrlName('TravelSubmissions')!.id,
      destinationSiteUrl: site.webUrl,
      libraryUrlName: 'Shared Documents',
      folders: ['Trips_Test', 'Trips_Test/Trips_To_Process'],
      adminEmail: 'max@example.com',
      appPageUrl: page
    });
  });

  it('checks, without changing anything, that the Accounting folder exists for a live package', async () => {
    const site = await setUpSite();
    const admin = serviceFor(site, MAX);
    await expect(admin.getFlowSettings('live', page)).rejects.toThrow('could not be found');
    site.libraries.add('/sites/ExecutiveTeam/Shared Documents');
    site.folders.add('/sites/ExecutiveTeam/Shared Documents/01_Company Documents/Accounting');
    const before = site.log.length;
    const config = await admin.getFlowSettings('live', page);
    expect(config.destinationSiteUrl).toBe('https://claruslabsusa.sharepoint.com/sites/ExecutiveTeam');
    expect(config.folders).toEqual(['01_Company Documents/Accounting/Trips', '01_Company Documents/Accounting/Trips/Trips_To_Process']);
    expect(site.log.slice(before).every((r) => r.method === 'GET')).toBe(true);
  });

  it('needs the lists first, and is for administrators only', async () => {
    const site = new FakeSharePoint();
    await expect(serviceFor(site, MAX).getFlowSettings('test', page)).rejects.toThrow(messages.flowNeedsLists);
    await expect(serviceFor(await setUpSite(), JANE).getFlowSettings('test', page)).rejects.toBeInstanceOf(NotAllowedError);
  });
});
