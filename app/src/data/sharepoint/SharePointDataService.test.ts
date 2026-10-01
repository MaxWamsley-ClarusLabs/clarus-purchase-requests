// The SharePoint data service against an in-memory fake of SharePoint's REST
// interface (src/testing/FakeSharePoint.ts). The rules both services follow are
// in ../mock/dataServiceContract.ts and run here too. Real SharePoint behaviour
// is confirmed on a test site at the checkpoint (docs/CHECKPOINT.md).

import { messages } from '../../domain/messages';
import { CERTIFICATION } from '../../domain/purchaseRules';
import { FakeOwner, FakeSharePoint, FakeUser } from '../../testing/FakeSharePoint';
import { uniqueName } from '../files';
import { Harness, JANE, MAX, Person, SAM, describeDataServiceRules } from '../mock/dataServiceContract';
import { SharePointRequestError, SpClient, SpFetch } from './http';
import { LISTS, SUBMISSION_TYPE_LABELS } from './schema';
import { NotAllowedError, SharePointDataService, hasPermission } from './SharePointDataService';

const FAKE_USERS: Record<string, FakeUser> = {
  [MAX.email]: { id: 1, title: MAX.name, email: MAX.email, admin: true },
  [JANE.email]: { id: 7, title: JANE.name, email: JANE.email, admin: false },
  [SAM.email]: { id: 8, title: SAM.name, email: SAM.email, admin: false }
};
const FAKE_MAX = FAKE_USERS[MAX.email];
const FAKE_JANE = FAKE_USERS[JANE.email];

const NOW = new Date(2026, 9, 16, 9, 30);
const PAGE = 'https://contoso.sharepoint.com/sites/FormsAndApps/SitePages/Purchase-Requests.aspx';

function serviceFor(site: FakeSharePoint, user: FakeUser, now = NOW): SharePointDataService {
  const client = new SpClient(site.fetchAs(user), site.webUrl, site.webPath, async () => undefined);
  return new SharePointDataService(client, () => now);
}

function file(name: string, content = `synthetic ${name}`): File {
  return new File([content], name, { type: name.endsWith('.pdf') ? 'application/pdf' : 'image/png' });
}

async function setUpSite(): Promise<FakeSharePoint> {
  const site = new FakeSharePoint();
  await serviceFor(site, FAKE_MAX).runSetup(() => undefined);
  return site;
}

async function harness(): Promise<Harness & { site: FakeSharePoint }> {
  const site = await setUpSite();
  return {
    site,
    as: (person: Person, now?: Date) => serviceFor(site, FAKE_USERS[person.email], now),
    setSubmissionState: (id, status, errorMessage = '') => {
      const item = site.listByUrlName('PurchaseSubmissions')!.items.get(id)!;
      item.fields.PackageStatus = status;
      item.fields.ErrorMessage = errorMessage;
    },
    addUploadingSubmission: (owner, request, type, number) => {
      const list = site.listByUrlName('PurchaseSubmissions')!;
      const id = list.nextId++;
      const author = FAKE_USERS[owner.email];
      list.items.set(id, {
        fields: {
          Id: id,
          Title: `${request.requestNumber} ${type === 'approval' ? 'approval' : 'submission'} ${number}`,
          AuthorId: author.id,
          Author: { Id: author.id, Title: author.title, EMail: author.email },
          RequestId: request.id,
          SubmissionType: SUBMISSION_TYPE_LABELS[type],
          SubmissionNumber: number,
          PackageStatus: 'Uploading',
          Created: '2026-10-16T09:30:00Z',
          Modified: '2026-10-16T09:30:00Z'
        },
        attachments: []
      });
      return id;
    },
    leaveApproval: (requestId, approver, approved) => {
      const fields = site.listByUrlName('PurchaseRequests')!.items.get(requestId)!.fields;
      const record = JSON.parse(String(fields.ApprovalRecord));
      const person = FAKE_USERS[approver.email];
      fields.ApprovalRecord = JSON.stringify({ sent: record.sent, approved });
      fields.ApprovedOn = new Date(2026, 9, 14, 10, 5).toISOString();
      fields.ApprovedById = person.id;
      fields.ApprovedBy = { Id: person.id, Title: person.title, EMail: person.email };
      fields.ApprovalNote = 'Left by an edit';
    }
  };
}

/** Jane fills in a request that needs no approval, with a receipt and a quote, and returns its ID. */
async function janeRequest(site: FakeSharePoint): Promise<{ id: number; lineId: string }> {
  const jane = serviceFor(site, FAKE_JANE);
  const request = await jane.createRequest();
  await jane.updateRequest(request.id, {
    businessPurpose: 'Lab supplies for the Phase 1 assay',
    department: 'R&D',
    projectCode: 'NSF SBIR Phase 1 (Award # 2528301)'
  });
  const [line] = await jane.addLinesFromFiles(request.id, [file('invoice.pdf')], 'receipt');
  await jane.updateLine(line.id, {
    date: '2026-10-12',
    vendor: 'Acme Lab Supply',
    description: 'Pipette tips',
    category: 'rdMaterials',
    amountCents: 45230,
    paidBy: 'employee'
  });
  await jane.addFileToLine(line.id, file('quote.pdf'), 'quote');
  return { id: request.id, lineId: line.id };
}

const stored = (site: FakeSharePoint, urlName: string, id: number): Record<string, unknown> => site.listByUrlName(urlName)!.items.get(id)!.fields;

describeDataServiceRules('SharePointDataService', harness);

describe('SharePoint permissions', () => {
  it('reads SharePoint permission masks, including values above 2^31', () => {
    expect(hasPermission({ High: '2147483647', Low: '4294967295' }, 31)).toBe(true);
    expect(hasPermission({ High: '432', Low: '1011028719' }, 31)).toBe(false);
    expect(hasPermission({ High: 0, Low: 1 }, 1)).toBe(true);
  });

  it('keeps file names unique on a row', () => {
    expect(uniqueName('receipt.pdf', new Set())).toBe('receipt.pdf');
    expect(uniqueName('receipt.pdf', new Set(['receipt.pdf', 'receipt (2).pdf']))).toBe('receipt (3).pdf');
    expect(uniqueName('Receipt.PDF', new Set(['receipt.pdf']))).toBe('Receipt (2).PDF');
  });

  it('compares email addresses in lower case', async () => {
    const site = await setUpSite();
    const mixed: FakeUser = { id: 9, title: 'Jane Doe', email: 'Jane.Doe@Example.com', admin: false };
    const jane = serviceFor(site, mixed);
    expect(await jane.getCurrentUser()).toEqual({ displayName: 'Jane Doe', email: 'jane.doe@example.com', isAdministrator: false });
    const created = await jane.createRequest();
    expect(created.ownerEmail).toBe('jane.doe@example.com');
    await jane.updateRequest(created.id, { department: 'R&D' });
    expect((await jane.listMyRequests()).map((r) => r.id)).toEqual([created.id]);
  });
});

describe('Site set-up (travel D-063)', () => {
  it('creates the three lists with their columns, own-items permissions and version history', async () => {
    const site = new FakeSharePoint();
    const admin = serviceFor(site, FAKE_MAX);
    expect((await admin.getSetupStatus()).ready).toBe(false);
    const steps: string[] = [];
    const status = await admin.runSetup((s) => steps.push(s));
    expect(status.ready).toBe(true);
    expect(status.lists.map((l) => l.key)).toEqual(['requests', 'lines', 'submissions']);
    expect(status.lists.map((l) => l.title)).toEqual(['Purchase Requests', 'Purchase Request Lines', 'Purchase Submissions']);
    expect(status.lists.map((l) => l.address)).toEqual(['Lists/PurchaseRequests', 'Lists/PurchaseRequestLines', 'Lists/PurchaseSubmissions']);
    expect(status.lists.every((l) => l.ownItemsOnly && l.versioning && l.attachments && l.listId)).toBe(true);
    expect(steps[0]).toBe('Creating the Purchase Requests list');
    expect(steps).toContain('Creating the Purchase Submissions list');
    expect(site.listByUrlName('PurchaseRequests')!.info.Title).toBe('Purchase Requests');
    expect(String(site.listByUrlName('PurchaseRequests')!.info.Description).startsWith('Purchase Requests app:')).toBe(true);
    for (const def of Object.values(LISTS)) {
      const list = site.listByUrlName(def.urlName)!;
      const names = list.fields.map((f) => f.InternalName);
      for (const field of def.fields) expect(names).toContain(field.name);
      expect(list.fields.find((f) => f.InternalName === 'Title')!.Title).toBe(def.titleDisplayName);
      expect(list.fields.find((f) => f.InternalName === 'Title')!.Required).toBe(false);
    }
  });

  it('indexes the columns the app filters on, and the built-in Author column', async () => {
    const site = await setUpSite();
    const indexed = (urlName: string) =>
      site
        .listByUrlName(urlName)!
        .fields.filter((f) => f.Indexed)
        .map((f) => f.InternalName)
        .sort();
    expect(indexed('PurchaseRequests')).toEqual(['Author', 'RequestStatus']);
    expect(indexed('PurchaseRequestLines')).toEqual(['RequestId']);
    expect(indexed('PurchaseSubmissions')).toEqual(['PackageStatus', 'RequestId']);
  });

  it('creates the choice columns with the choices from the domain', async () => {
    const site = await setUpSite();
    const choices = (urlName: string, name: string) => site.listByUrlName(urlName)!.fields.find((f) => f.InternalName === name)!.Choices;
    expect(choices('PurchaseRequests', 'RequestStatus')).toEqual(['Draft', 'Awaiting approval', 'Approved', 'Submitted', 'Returned', 'Processed']);
    expect(choices('PurchaseRequests', 'ReturnStage')).toEqual(['Approval', 'Processing']);
    expect(choices('PurchaseRequestLines', 'PaidBy')).toEqual(['Company', 'Employee']);
    expect(choices('PurchaseRequestLines', 'Category')).toHaveLength(8);
    expect(choices('PurchaseRequestLines', 'Category')).toContain('R&D Materials & Supplies / Equipment');
    expect(choices('PurchaseSubmissions', 'SubmissionType')).toEqual(['Approval request', 'Processing package']);
    expect(choices('PurchaseSubmissions', 'PackageStatus')).toEqual(['Uploading', 'Ready', 'Processing', 'Packaged', 'Failed']);
  });

  it('only adds what is missing when run again, and never removes anything', async () => {
    const site = await setUpSite();
    const requests = site.listByUrlName('PurchaseRequests')!;
    requests.fields = requests.fields.filter((f) => f.InternalName !== 'ApprovalRecord');
    const submissions = site.listByUrlName('PurchaseSubmissions')!;
    submissions.fields = submissions.fields.filter((f) => f.InternalName !== 'QuoteCount');
    const before = site.log.length;
    const admin = serviceFor(site, FAKE_MAX);
    const check = await admin.getSetupStatus();
    expect(check.ready).toBe(false);
    expect(check.lists[0].missingFields).toEqual(['ApprovalRecord']);
    expect(check.lists[2].missingFields).toEqual(['QuoteCount']);
    await admin.runSetup(() => undefined);
    expect((await admin.getSetupStatus()).ready).toBe(true);
    expect(site.log.slice(before).filter((r) => r.url.endsWith('/_api/web/lists'))).toEqual([]);
    expect(site.log.slice(before).filter((r) => r.method === 'DELETE')).toEqual([]);
  });

  it('adds a choice a newer version of the app uses, keeping the ones already there', async () => {
    const site = await setUpSite();
    const status = site.listByUrlName('PurchaseRequests')!.fields.find((f) => f.InternalName === 'RequestStatus')!;
    status.Choices = ['Draft', 'Submitted', 'Custom status'];
    const admin = serviceFor(site, FAKE_MAX);
    const check = await admin.getSetupStatus();
    expect(check.ready).toBe(false);
    expect(check.lists[0].missingChoices).toEqual(['Status: Awaiting approval', 'Status: Approved', 'Status: Returned', 'Status: Processed']);
    await admin.runSetup(() => undefined);
    expect(status.Choices).toEqual(['Draft', 'Submitted', 'Custom status', 'Awaiting approval', 'Approved', 'Returned', 'Processed']);
    expect((await admin.getSetupStatus()).ready).toBe(true);
  });

  it('indexes a column that was not indexed', async () => {
    const site = await setUpSite();
    site.listByUrlName('PurchaseSubmissions')!.fields.find((f) => f.InternalName === 'PackageStatus')!.Indexed = false;
    const admin = serviceFor(site, FAKE_MAX);
    expect((await admin.getSetupStatus()).lists[2].unindexedFields).toEqual(['PackageStatus']);
    const steps: string[] = [];
    await admin.runSetup((s) => steps.push(s));
    expect(steps).toContain('Indexing PackageStatus on Purchase Submissions');
    expect((await admin.getSetupStatus()).ready).toBe(true);
  });

  it('is not ready if the own-items permission could not be set, so the page can show the manual steps', async () => {
    const site = new FakeSharePoint();
    site.refuseItemLevelPermissions = true;
    const status = await serviceFor(site, FAKE_MAX).runSetup(() => undefined);
    expect(status.ready).toBe(false);
    expect(status.lists.every((l) => !l.ownItemsOnly)).toBe(true);
  });

  it('is for administrators only', async () => {
    const site = new FakeSharePoint();
    await expect(serviceFor(site, FAKE_JANE).runSetup(() => undefined)).rejects.toBeInstanceOf(NotAllowedError);
    expect(site.lists.size).toBe(0);
  });

  it('leaves alone a list at one of its addresses that another app made (travel D-077)', async () => {
    for (const [urlName, key] of [
      ['PurchaseRequests', 'requests'],
      ['PurchaseRequestLines', 'lines'],
      ['PurchaseSubmissions', 'submissions']
    ] as const) {
      const site = new FakeSharePoint();
      const other = site.addOtherList(urlName, ['Status']);
      const steps: string[] = [];
      const status = await serviceFor(site, FAKE_MAX).runSetup((s) => steps.push(s));
      expect(status.ready).toBe(false);
      const check = status.lists.find((l) => l.key === key)!;
      expect(check.notOurs).toBe(true);
      expect(steps).toContain(`Left Lists/${urlName} unchanged: that list was not made by this app`);
      // The other list keeps its own columns and settings.
      expect(other.fields.map((f) => f.InternalName)).not.toContain('SubmissionNumber');
      expect(other.fields.map((f) => f.InternalName)).not.toContain('RequestId');
      expect(other.info.ReadSecurity).toBe(1);
      expect(other.info.EnableVersioning).toBe(false);
      // The two lists that were free are created as usual.
      expect(status.lists.filter((l) => l.key !== key).every((l) => l.exists && !l.notOurs && l.ownItemsOnly)).toBe(true);
      await expect(serviceFor(site, FAKE_MAX).getFlowSettings('test', PAGE)).rejects.toThrow();
    }
  });

  it("shares the site with the travel app's lists without touching them", async () => {
    const site = new FakeSharePoint();
    const travel = [site.addOtherList('TravelReports', ['ReportNumber']), site.addOtherList('TravelSubmissions', ['ReportId'])];
    const status = await serviceFor(site, FAKE_MAX).runSetup(() => undefined);
    expect(status.ready).toBe(true);
    expect(travel.every((l) => l.info.ReadSecurity === 1 && l.fields.length < 12)).toBe(true);
  });

  it('still treats its own list as its own when the description was edited', async () => {
    const site = await setUpSite();
    site.listByUrlName('PurchaseRequests')!.info.Description = 'Edited by an owner';
    const status = await serviceFor(site, FAKE_MAX).getSetupStatus();
    expect(status.ready).toBe(true);
    expect(status.lists.every((l) => !l.notOurs)).toBe(true);
  });
});

describe('what is stored in the lists (docs/DATA_MODEL.md)', () => {
  it("writes a request's header, totals, approval record and number as columns", async () => {
    const site = await setUpSite();
    const { id } = await janeRequest(site);
    expect(stored(site, 'PurchaseRequests', id)).toMatchObject({
      Title: 'Lab supplies for the Phase 1 assay',
      RequestNumber: 'PR-0001',
      Department: 'R&D',
      ProjectCode: 'NSF SBIR Phase 1 (Award # 2528301)',
      RequestStatus: 'Draft',
      SubmissionCount: 0,
      ApprovalRounds: 0,
      TotalReimburse: 452.3,
      TotalCompany: 0,
      TotalRequest: 452.3,
      BoughtBeforeApproval: false,
      ApprovalRecord: '{"sent":[],"approved":[]}',
      AuthorId: FAKE_JANE.id
    });
  });

  it("writes a row's values with choice labels and dollars, and each file's kind with its fingerprint", async () => {
    const site = await setUpSite();
    const { lineId } = await janeRequest(site);
    const fields = stored(site, 'PurchaseRequestLines', Number(lineId));
    expect(fields).toMatchObject({
      Title: 'PR-0001 row 1',
      RequestId: 1,
      RowNumber: 1,
      PurchaseDate: '2026-10-12',
      Vendor: 'Acme Lab Supply',
      Description: 'Pipette tips',
      Category: 'R&D Materials & Supplies / Equipment',
      Amount: 452.3,
      PaidBy: 'Employee'
    });
    const prints = JSON.parse(String(fields.FileFingerprints));
    expect(prints).toEqual([
      { fileName: 'invoice.pdf', sizeBytes: 'synthetic invoice.pdf'.length, fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/), kind: 'receipt' },
      { fileName: 'quote.pdf', sizeBytes: 'synthetic quote.pdf'.length, fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/), kind: 'quote' }
    ]);
    expect(
      site
        .listByUrlName('PurchaseRequestLines')!
        .items.get(Number(lineId))!
        .attachments.map((a) => a.name)
    ).toEqual(['invoice.pdf', 'quote.pdf']);
  });

  it("stores unconfirmed suggestions in the grid's order", async () => {
    const site = await setUpSite();
    const { lineId } = await janeRequest(site);
    await serviceFor(site, FAKE_JANE).updateLine(lineId, { suggested: ['paidBy', 'amount'] });
    expect(stored(site, 'PurchaseRequestLines', Number(lineId)).SuggestedFields).toBe('amount,paidBy');
  });

  it('keeps the receipt after a file is removed: the fingerprints list loses only that file', async () => {
    const site = await setUpSite();
    const { lineId } = await janeRequest(site);
    const jane = serviceFor(site, FAKE_JANE);
    await jane.removeFileFromLine(lineId, 'quote.pdf');
    const prints = JSON.parse(String(stored(site, 'PurchaseRequestLines', Number(lineId)).FileFingerprints));
    expect(prints.map((p: { fileName: string; kind: string }) => [p.fileName, p.kind])).toEqual([['invoice.pdf', 'receipt']]);
    expect(
      site
        .listByUrlName('PurchaseRequestLines')!
        .items.get(Number(lineId))!
        .attachments.map((a) => a.name)
    ).toEqual(['invoice.pdf']);
  });

  it('relabels the rows after a deletion, so the list reads right to anyone viewing it directly', async () => {
    const site = await setUpSite();
    const jane = serviceFor(site, FAKE_JANE);
    const request = await jane.createRequest();
    const [a, b, c] = await jane.addLinesFromFiles(request.id, [file('a.pdf'), file('b.pdf'), file('c.pdf')], 'receipt');
    const titles = () => [1, 2, 3, 4].map((n) => site.listByUrlName('PurchaseRequestLines')!.items.get(n)?.fields.Title);
    expect(titles()).toEqual(['PR-0001 row 1', 'PR-0001 row 2', 'PR-0001 row 3', undefined]);
    await jane.deleteLine(a.id);
    expect(titles()).toEqual([undefined, 'PR-0001 row 1', 'PR-0001 row 2', undefined]);
    expect([b.id, c.id]).toEqual(['2', '3']);
  });

  it('records the approver as a person column and the time, and clears them when the approval is taken back', async () => {
    const site = await setUpSite();
    const jane = serviceFor(site, FAKE_JANE);
    const request = await jane.createRequest();
    await jane.updateRequest(request.id, { businessPurpose: 'Lab supplies', department: 'R&D' });
    const line = await jane.addEmptyLine(request.id);
    await jane.updateLine(line.id, {
      date: '2026-10-20',
      vendor: 'Acme Lab Supply',
      description: 'Pipette tips',
      category: 'rdMaterials',
      amountCents: 100000
    });
    await jane.addFileToLine(line.id, file('quote.pdf'), 'quote');
    await jane.sendForApproval(request.id);
    expect(stored(site, 'PurchaseRequests', request.id)).toMatchObject({
      RequestStatus: 'Awaiting approval',
      ApprovalRounds: 1,
      SentForApprovalOn: NOW.toISOString(),
      BoughtBeforeApproval: false,
      ReturnNote: '',
      ReturnStage: null,
      ApprovedOn: null,
      ApprovedById: null
    });
    expect(JSON.parse(String(stored(site, 'PurchaseRequests', request.id).ApprovalRecord))).toEqual({
      sent: [{ key: 'acme lab supply', vendor: 'Acme Lab Supply', cents: 100000, bought: false }],
      approved: []
    });

    const max = serviceFor(site, FAKE_MAX, new Date(2026, 9, 17, 10, 5));
    await max.approveRequest(request.id, { note: 'OK', categories: {} });
    expect(stored(site, 'PurchaseRequests', request.id)).toMatchObject({
      RequestStatus: 'Approved',
      ApprovedOn: new Date(2026, 9, 17, 10, 5).toISOString(),
      ApprovedById: FAKE_MAX.id,
      ApprovedBy: { Id: FAKE_MAX.id, Title: 'Max Wamsley', EMail: 'max.wamsley@example.com' },
      ApprovalNote: 'OK'
    });
    expect(stored(site, 'PurchaseRequestLines', 1)).toMatchObject({ CategoryConfirmedBy: 'Max Wamsley', Category: 'R&D Materials & Supplies / Equipment' });

    // Back to awaiting approval, then returned: the person and the time are cleared, the stage is written.
    await jane.updateLine(line.id, { amountCents: 130000 });
    await jane.sendForApproval(request.id);
    expect(stored(site, 'PurchaseRequests', request.id)).toMatchObject({ ApprovedBy: null, ApprovedOn: null, ApprovalNote: '' });
    await max.returnRequest(request.id, 'Please add a quote.');
    expect(stored(site, 'PurchaseRequests', request.id)).toMatchObject({
      RequestStatus: 'Returned',
      ReturnNote: 'Please add a quote.',
      ReturnStage: 'Approval',
      ApprovedBy: null
    });
  });

  it('writes the return stage Processing and keeps the approval when a submitted request is returned', async () => {
    const site = await setUpSite();
    const { id, lineId } = await janeRequest(site);
    const jane = serviceFor(site, FAKE_JANE);
    await jane.submitRequest(id, CERTIFICATION);
    await serviceFor(site, FAKE_MAX).returnRequest(id, 'Please attach the itemized invoice.');
    expect(stored(site, 'PurchaseRequests', id)).toMatchObject({
      RequestStatus: 'Returned',
      ReturnStage: 'Processing',
      ReturnNote: 'Please attach the itemized invoice.'
    });
    await jane.updateLine(lineId, { description: 'Pipette tips, second box' });
    await jane.submitRequest(id, CERTIFICATION);
    expect(stored(site, 'PurchaseRequests', id)).toMatchObject({ RequestStatus: 'Submitted', ReturnNote: '', ReturnStage: null, SubmissionCount: 2 });
  });

  it("writes the submission as the app does, and the flow's columns stay empty", async () => {
    const site = await setUpSite();
    const { id } = await janeRequest(site);
    const jane = serviceFor(site, FAKE_JANE);
    const submission = await jane.submitRequest(id, CERTIFICATION);
    expect(stored(site, 'PurchaseSubmissions', submission.id)).toMatchObject({
      Title: 'PR-0001 submission 1',
      RequestId: id,
      SubmissionType: 'Processing package',
      SubmissionNumber: 1,
      PackageStatus: 'Ready',
      FolderName: '2026-10-12_Jane-Doe_Lab-supplies-for-the-Phase-1-assay_PR-0001',
      PreviousFolderName: '',
      SubmitterName: 'Jane Doe',
      SubmitterEmail: 'jane.doe@example.com',
      CertificationText: CERTIFICATION,
      BusinessPurpose: 'Lab supplies for the Phase 1 assay',
      Department: 'R&D',
      ProjectCode: 'NSF SBIR Phase 1 (Award # 2528301)',
      PurchaseDates: '2026-10-12',
      TotalReimburse: 452.3,
      TotalCompany: 0,
      TotalRequest: 452.3,
      ReceiptCount: 1,
      QuoteCount: 1,
      RowsWithoutReceipt: 0,
      BoughtBeforeApproval: false,
      ApprovedBy: '',
      ApprovedOn: '',
      EmailSubject: 'Purchase request submitted: Jane Doe, Lab supplies for the Phase 1 assay (PR-0001)'
    });
    const fields = stored(site, 'PurchaseSubmissions', submission.id);
    for (const flowColumn of ['FolderLink', 'PackagedAt', 'ErrorMessage']) expect(fields[flowColumn] ?? null).toBeNull();
    expect(String(fields.EmailSummary)).toContain('Submitted by: Jane Doe (jane.doe@example.com)');
  });

  it('writes an approval request as its own type, titled "approval", with no attachments', async () => {
    const site = await setUpSite();
    const jane = serviceFor(site, FAKE_JANE);
    const request = await jane.createRequest();
    await jane.updateRequest(request.id, { businessPurpose: 'Lab supplies', department: 'R&D' });
    const line = await jane.addEmptyLine(request.id);
    await jane.updateLine(line.id, {
      date: '2026-10-20',
      vendor: 'Acme Lab Supply',
      description: 'Pipette tips',
      category: 'rdMaterials',
      amountCents: 100000
    });
    await jane.addFileToLine(line.id, file('quote.pdf'), 'quote');
    const approval = await jane.sendForApproval(request.id);
    expect(stored(site, 'PurchaseSubmissions', approval.id)).toMatchObject({
      Title: 'PR-0001 approval 1',
      SubmissionType: 'Approval request',
      SubmissionNumber: 1,
      PackageStatus: 'Ready',
      FolderName: '',
      CertificationText: '',
      QuoteCount: 1,
      ReceiptCount: 0
    });
    expect(site.listByUrlName('PurchaseSubmissions')!.items.get(approval.id)!.attachments).toEqual([]);
  });

  it('attaches the package files with their content, and the CSV with a byte-order mark', async () => {
    const site = await setUpSite();
    const { id } = await janeRequest(site);
    const submission = await serviceFor(site, FAKE_JANE).submitRequest(id, CERTIFICATION);
    const attachments = site.listByUrlName('PurchaseSubmissions')!.items.get(submission.id)!.attachments;
    expect(attachments.map((a) => a.name).sort()).toEqual(['PR-0001_Purchases.csv', 'Q01_quote.pdf', 'R01_invoice.pdf']);
    const content = async (name: string) => attachments.find((a) => a.name === name)!.content.text();
    expect(await content('R01_invoice.pdf')).toBe('synthetic invoice.pdf');
    expect(await content('Q01_quote.pdf')).toBe('synthetic quote.pdf');
    // The stored file starts with the UTF-8 byte-order mark (travel D-045); reading it as text drops the mark.
    const csv = attachments.find((a) => a.name === 'PR-0001_Purchases.csv')!;
    expect(Array.from(new Uint8Array(await csv.content.arrayBuffer())).slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    expect(await serviceFor(site, FAKE_JANE).getSubmissionCsv(submission.id)).toContain('Jane Doe (jane.doe@example.com)');
  });

  it('reads items that were edited directly in SharePoint without being fooled or failing (travel D-002)', async () => {
    const site = await setUpSite();
    const { id, lineId } = await janeRequest(site);
    const fields = stored(site, 'PurchaseRequests', id);
    fields.RequestStatus = 'Approved!';
    fields.ApprovalRecord = '{not json';
    fields.ReturnStage = 'Whenever';
    fields.TotalReimburse = 'lots';
    fields.SubmissionCount = -5;
    const line = stored(site, 'PurchaseRequestLines', Number(lineId));
    line.Category = 'Snacks';
    line.FileFingerprints = '[not json';
    const jane = serviceFor(site, FAKE_JANE);
    const { request, lines } = await jane.getRequest(id);
    expect(request).toMatchObject({ status: 'Draft', approval: { sent: [], approved: [] }, returnStage: '', totalReimburseCents: 0, submissionCount: 0 });
    expect(lines[0]).toMatchObject({ category: '' });
    expect(lines[0].files.map((f) => [f.fileName, f.kind, f.fingerprint])).toEqual([
      ['invoice.pdf', 'receipt', ''],
      ['quote.pdf', 'receipt', '']
    ]);
  });
});

describe('what the REST calls do, and in what order', () => {
  const methods = (site: FakeSharePoint, from: number) => site.log.slice(from).filter((r) => r.method !== 'GET');

  it('hands a package to the flow last: created Uploading, files attached, request locked, then Ready', async () => {
    const site = await setUpSite();
    const { id } = await janeRequest(site);
    const before = site.log.length;
    await serviceFor(site, FAKE_JANE).submitRequest(id, CERTIFICATION);
    const writes = methods(site, before);
    const kinds = writes.map((r) => {
      if (r.url.includes('PurchaseSubmissions') && r.url.endsWith('/items')) return 'create submission';
      if (r.url.includes('PurchaseSubmissions') && r.url.includes('AttachmentFiles')) return 'attach file';
      if (r.url.includes('PurchaseRequests')) return 'update request';
      if (r.url.includes('PurchaseSubmissions')) return 'update submission';
      return `other ${r.url}`;
    });
    expect(kinds).toEqual(['create submission', 'attach file', 'attach file', 'attach file', 'update request', 'update submission']);
    expect(JSON.parse(writes[0].body!)).toMatchObject({ PackageStatus: 'Uploading', SubmissionType: 'Processing package' });
    expect(JSON.parse(writes[4].body!)).toMatchObject({ RequestStatus: 'Submitted', SubmissionCount: 1 });
    expect(JSON.parse(writes[5].body!)).toEqual({ PackageStatus: 'Ready' });
    expect(writes.every((r) => r.user === JANE.email)).toBe(true);
  });

  it('hands an approval request to the flow last: created Uploading with no files, request locked, then Ready', async () => {
    const site = await setUpSite();
    const jane = serviceFor(site, FAKE_JANE);
    const request = await jane.createRequest();
    await jane.updateRequest(request.id, { businessPurpose: 'Lab supplies', department: 'R&D' });
    const line = await jane.addEmptyLine(request.id);
    await jane.updateLine(line.id, {
      date: '2026-10-20',
      vendor: 'Acme Lab Supply',
      description: 'Pipette tips',
      category: 'rdMaterials',
      amountCents: 100000
    });
    await jane.addFileToLine(line.id, file('quote.pdf'), 'quote');
    const before = site.log.length;
    await jane.sendForApproval(request.id);
    const writes = methods(site, before);
    expect(writes.map((r) => [r.method, r.url.includes('PurchaseSubmissions') ? 'submissions' : 'requests', r.url.endsWith('/items')])).toEqual([
      ['POST', 'submissions', true],
      ['MERGE', 'requests', false],
      ['MERGE', 'submissions', false]
    ]);
    expect(JSON.parse(writes[0].body!)).toMatchObject({ PackageStatus: 'Uploading', SubmissionType: 'Approval request' });
    expect(JSON.parse(writes[1].body!)).toMatchObject({ RequestStatus: 'Awaiting approval' });
    expect(JSON.parse(writes[2].body!)).toEqual({ PackageStatus: 'Ready' });
  });

  it('moves rows and requests to the recycle bin instead of deleting them, rows first', async () => {
    const site = await setUpSite();
    const jane = serviceFor(site, FAKE_JANE);
    const request = await jane.createRequest();
    const [a] = await jane.addLinesFromFiles(request.id, [file('a.pdf'), file('b.pdf')], 'receipt');
    const before = site.log.length;
    await jane.deleteLine(a.id);
    expect(methods(site, before).some((r) => r.method === 'DELETE' && r.url.includes('/items('))).toBe(false);
    expect(methods(site, before)[0].url).toMatch(/PurchaseRequestLines.*items\(1\)\/recycle\(\)$/);
    const second = site.log.length;
    await jane.deleteRequest(request.id);
    const recycles = methods(site, second).filter((r) => r.url.endsWith('/recycle()'));
    expect(recycles.map((r) => (r.url.includes('PurchaseRequestLines') ? 'line' : 'request'))).toEqual(['line', 'request']);
    expect(methods(site, second).filter((r) => r.method === 'DELETE')).toEqual([]);
    expect(site.listByUrlName('PurchaseRequests')!.items.size).toBe(0);
    expect(site.listByUrlName('PurchaseRequestLines')!.items.size).toBe(0);
  });

  it("asks SharePoint only for the signed-in person's own requests when listing their requests", async () => {
    const site = await setUpSite();
    const before = site.log.length;
    await serviceFor(site, FAKE_JANE).listMyRequests();
    const reads = site.log.slice(before).filter((r) => decodeURIComponent(r.url).includes('PurchaseRequests'));
    expect(reads).toHaveLength(1);
    expect(decodeURIComponent(reads[0].url)).toContain(`$filter=AuthorId eq ${FAKE_JANE.id}`);
    expect(decodeURIComponent(reads[0].url)).toContain('ApprovedBy/EMail');
    expect(decodeURIComponent(reads[0].url)).toContain('$expand=Author,ApprovedBy,ProcessedBy');
  });

  it('keeps the request totals current from the stored fingerprints, without reading the attachments', async () => {
    const site = await setUpSite();
    const { id, lineId } = await janeRequest(site);
    const before = site.log.length;
    await serviceFor(site, FAKE_JANE).updateLine(lineId, { amountCents: 50000 });
    // The row itself is read with its attachments; the read of all the request's rows for the totals is not.
    const reads = site.log.slice(before).filter((r) => r.method === 'GET' && decodeURIComponent(r.url).includes('$filter=RequestId eq'));
    expect(reads).toHaveLength(1);
    expect(decodeURIComponent(reads[0].url)).not.toContain('AttachmentFiles');
    expect(stored(site, 'PurchaseRequests', id)).toMatchObject({ TotalReimburse: 500, TotalRequest: 500 });
  });
});

describe('the approvers (P-018, P-020)', () => {
  const owners: FakeOwner[] = [
    { Title: 'Max Wamsley', Email: 'Max.Wamsley@Example.com', PrincipalType: 1 },
    { Title: 'Pat Rivera', Email: 'pat.rivera@example.com', PrincipalType: 1 },
    { Title: 'Clarus Admins', Email: 'admins@example.com', PrincipalType: 4 },
    { Title: 'Site Owners', Email: '', PrincipalType: 8 },
    { Title: '  ', Email: 'blank.title@example.com', PrincipalType: 1 },
    { Title: 'Max Wamsley (second account)', Email: 'max.wamsley@example.com', PrincipalType: 1 },
    { Title: 'No Mail', Email: '', PrincipalType: 1 }
  ];

  it('lists the names of the people in the Owners group, skipping groups and blank names', async () => {
    const site = await setUpSite();
    site.owners = owners;
    expect(await serviceFor(site, FAKE_MAX).listApprovers()).toEqual(['Max Wamsley', 'Pat Rivera', 'Max Wamsley (second account)', 'No Mail']);
    // Anyone may ask; an employee who cannot read the group gets an empty list.
    expect(await serviceFor(site, FAKE_JANE).listApprovers()).toEqual(['Max Wamsley', 'Pat Rivera', 'Max Wamsley (second account)', 'No Mail']);
    site.owners = [];
    expect(await serviceFor(site, FAKE_MAX).listApprovers()).toEqual([]);
  });

  it('returns an empty list when the Owners group cannot be read: refused, missing, or the network is down', async () => {
    for (const status of [403, 404, 500]) {
      const refused = await setUpSite();
      refused.owners = owners;
      refused.ownersStatus = status;
      expect([status, await serviceFor(refused, FAKE_JANE).listApprovers()]).toEqual([status, []]);
    }
    const site = await setUpSite();
    site.owners = owners;
    const offline: SpFetch = (url, init) => (url.includes('AssociatedOwnerGroup') ? Promise.reject(new Error('offline')) : site.fetchAs(FAKE_JANE)(url, init));
    const client = new SpClient(offline, site.webUrl, site.webPath, async () => undefined);
    expect(await new SharePointDataService(client, () => NOW).listApprovers()).toEqual([]);
  });

  it('asks for the Owners group once, by its address on the site, with only the columns it needs', async () => {
    const site = await setUpSite();
    site.owners = owners;
    const before = site.log.length;
    await serviceFor(site, FAKE_MAX).listApprovers();
    const reads = site.log.slice(before).filter((r) => r.url.includes('AssociatedOwnerGroup'));
    expect(reads.map((r) => [r.method, decodeURIComponent(r.url)])).toEqual([
      ['GET', `${site.webUrl}/_api/web/AssociatedOwnerGroup/users?$select=Title,Email,PrincipalType`]
    ]);
  });
});

describe('Flow package settings (travel D-047, P-018)', () => {
  it('reads the Purchase Submissions list, the test library, the administrator and the approvers for a test package', async () => {
    const site = await setUpSite();
    site.owners = [
      { Title: 'Max Wamsley', Email: 'MAX@example.com', PrincipalType: 1 },
      { Title: 'Pat Rivera', Email: 'pat.rivera@example.com', PrincipalType: 1 }
    ];
    const config = await serviceFor(site, FAKE_MAX).getFlowSettings('test', PAGE);
    expect(config).toEqual({
      mode: 'test',
      siteUrl: site.webUrl,
      submissionsListId: site.listByUrlName('PurchaseSubmissions')!.id,
      destinationSiteUrl: site.webUrl,
      libraryUrlName: 'Shared Documents',
      folders: ['Purchases_Test', 'Purchases_Test/Purchases_To_Process'],
      adminEmail: MAX.email,
      approverEmails: ['max@example.com', 'pat.rivera@example.com'],
      appPageUrl: PAGE
    });
    expect(site.webUrl).toBe('https://contoso.sharepoint.com/sites/FormsAndApps');
  });

  it('lists each approver once, in lower case, from the people in the Owners group only', async () => {
    const site = await setUpSite();
    site.owners = [
      { Title: 'Max Wamsley', Email: 'Max.Wamsley@Example.com', PrincipalType: 1 },
      { Title: 'Max again', Email: 'max.wamsley@example.com', PrincipalType: 1 },
      { Title: 'Clarus Admins', Email: 'admins@example.com', PrincipalType: 4 },
      { Title: 'No Mail', Email: '', PrincipalType: 1 },
      { Title: 'Two addresses', Email: 'a@example.com; b@example.com', PrincipalType: 1 },
      { Title: 'Spaces', Email: 'not an address', PrincipalType: 1 },
      // Addresses go into the flow as text, so anything that could read as an expression or markup is refused.
      { Title: 'Braces', Email: 'x@exa{mple}.com', PrincipalType: 1 },
      { Title: 'Expression', Email: 'x@{outputs(1)}.com', PrincipalType: 1 },
      { Title: 'Quotes', Email: 'a"b@example.com', PrincipalType: 1 },
      { Title: 'Markup', Email: '<b>@example.com', PrincipalType: 1 },
      { Title: 'Pat Rivera', Email: ' pat.rivera@example.com ', PrincipalType: 1 }
    ];
    const config = await serviceFor(site, FAKE_MAX).getFlowSettings('test', PAGE);
    expect(config.approverEmails).toEqual(['max.wamsley@example.com', 'pat.rivera@example.com']);
  });

  it("falls back to the administrator's own address when no approver can be read or none has an address", async () => {
    const site = await setUpSite();
    const admin = serviceFor(site, FAKE_MAX);
    expect((await admin.getFlowSettings('test', PAGE)).approverEmails).toEqual([MAX.email]);
    site.owners = [
      { Title: 'No Mail', Email: '', PrincipalType: 1 },
      { Title: 'Clarus Admins', Email: 'admins@example.com', PrincipalType: 4 }
    ];
    expect((await admin.getFlowSettings('test', PAGE)).approverEmails).toEqual([MAX.email]);
    site.owners = [{ Title: 'Pat Rivera', Email: 'pat.rivera@example.com', PrincipalType: 1 }];
    site.ownersStatus = 403;
    const config = await admin.getFlowSettings('test', PAGE);
    expect(config.approverEmails).toEqual([MAX.email]);
    expect(config.adminEmail).toBe(MAX.email);
  });

  it('checks, without changing anything, that the Accounting folder exists for a live package', async () => {
    const site = await setUpSite();
    const admin = serviceFor(site, FAKE_MAX);
    await expect(admin.getFlowSettings('live', PAGE)).rejects.toThrow('could not be found');
    site.libraries.add('/sites/ExecutiveTeam/Shared Documents');
    await expect(admin.getFlowSettings('live', PAGE)).rejects.toThrow('01_Company Documents/Accounting');
    site.folders.add('/sites/ExecutiveTeam/Shared Documents/01_Company Documents/Accounting');
    const before = site.log.length;
    const config = await admin.getFlowSettings('live', PAGE);
    expect(config.mode).toBe('live');
    expect(config.siteUrl).toBe(site.webUrl);
    expect(config.destinationSiteUrl).toBe('https://claruslabsusa.sharepoint.com/sites/ExecutiveTeam');
    expect(config.libraryUrlName).toBe('Shared Documents');
    expect(config.folders).toEqual(['01_Company Documents/Accounting/Purchases', '01_Company Documents/Accounting/Purchases/Purchases_To_Process']);
    expect(site.log.slice(before).every((r) => r.method === 'GET')).toBe(true);
  });

  it('needs the lists first, and is for administrators only', async () => {
    const site = new FakeSharePoint();
    await expect(serviceFor(site, FAKE_MAX).getFlowSettings('test', PAGE)).rejects.toThrow(messages.flowNeedsLists);
    await expect(serviceFor(await setUpSite(), FAKE_JANE).getFlowSettings('test', PAGE)).rejects.toBeInstanceOf(NotAllowedError);
  });
});

describe('file previews', () => {
  it("loads the file as the app, so the site's download settings cannot block it, with the right type", async () => {
    const site = await setUpSite();
    const { lineId } = await janeRequest(site);
    const jane = serviceFor(site, FAKE_JANE);
    const line = (await jane.getRequest(1)).lines[0];
    const url = await jane.filePreviewUrl(lineId, line.files[0]);
    expect(url.startsWith('blob:')).toBe(true);
    URL.revokeObjectURL(url);
  });
});

describe('waiting while SharePoint is busy', () => {
  it('waits and tries again, using the time SharePoint asked for', async () => {
    const site = await setUpSite();
    const waits: number[] = [];
    const client = new SpClient(site.fetchAs(FAKE_JANE), site.webUrl, site.webPath, async (ms) => {
      waits.push(ms);
    });
    const jane = new SharePointDataService(client, () => NOW);
    await jane.getCurrentUser();
    site.busyReplies = 2;
    const request = await jane.createRequest();
    expect(request.requestNumber).toBe('PR-0001');
    expect(waits).toEqual([1000, 1000]);
  });

  it('gives up with a plain message after four busy replies', async () => {
    const site = await setUpSite();
    const jane = serviceFor(site, FAKE_JANE);
    await jane.getCurrentUser();
    site.busyReplies = 10;
    const failure = await jane.createRequest().then(
      () => undefined,
      (e: unknown) => e
    );
    expect(failure).toBeInstanceOf(SharePointRequestError);
    expect((failure as SharePointRequestError).status).toBe(429);
    expect((failure as SharePointRequestError).message).toBe(messages.spBusy);
    site.busyReplies = 0;
    // Nothing was half made: the failed request left no item behind.
    expect(site.listByUrlName('PurchaseRequests')!.items.size).toBe(0);
  });
});
