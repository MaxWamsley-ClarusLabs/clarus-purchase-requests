import { toLocalDateTime } from '../../domain/dates';
import { CATEGORIES, CERTIFICATION, PAID_BY_OPTIONS, vendorKey } from '../../domain/purchaseRules';
import { REQUEST_STATUSES } from '../../domain/statuses';
import { prepareApprovalRequest, prepareSubmission } from '../../export/submission';
import { file, line, quote, request } from '../../testing/builders';
import {
  LineItem,
  RequestItem,
  SubmissionItem,
  approvalRecordJson,
  centsToDollars,
  contentTypeFor,
  lineFields,
  lineFromItem,
  localTime,
  parseApprovalRecord,
  parseFingerprints,
  parseSuggested,
  requestFields,
  requestFromItem,
  storedFingerprint,
  submissionFields,
  submissionFromItem
} from './mapping';
import { APP_LIST_MARKER, LISTS, PACKAGE_STATUSES, RETURN_STAGE_LABELS, SUBMISSION_TYPE_LABELS, fieldXml } from './schema';

const requestItem = (overrides: Partial<RequestItem> = {}): RequestItem => ({
  Id: 42,
  Title: 'Lab supplies for the Phase 1 assay',
  RequestNumber: 'PR-0042',
  Department: 'R&D',
  ProjectCode: 'NSF SBIR Phase 1 (Award # 2528301)',
  RequestStatus: 'Approved',
  ReturnNote: null,
  ReturnStage: null,
  TotalReimburse: 452.3,
  TotalCompany: 0.1 + 0.2,
  TotalRequest: null,
  SubmissionCount: 1,
  ApprovalRounds: 2,
  SentForApprovalOn: '2026-10-14T09:12:00Z',
  BoughtBeforeApproval: true,
  ApprovalRecord: JSON.stringify({
    sent: [{ key: 'acme lab supply', vendor: 'Acme Lab Supply', cents: 64000, bought: true }],
    approved: [{ key: 'acme lab supply', vendor: 'Acme Lab Supply', cents: 64000, bought: true }]
  }),
  ApprovalNote: 'OK, use the company card.',
  ApprovedOn: '2026-10-15T10:05:00Z',
  ApprovedBy: { Title: 'Max Wamsley', EMail: 'Max.Wamsley@Example.com' },
  SubmittedOn: '2026-10-16T14:30:00Z',
  ProcessedOn: null,
  ProcessedBy: null,
  Author: { Title: 'Jane Doe', EMail: 'Jane.Doe@Example.com' },
  Modified: '2026-10-16T14:30:00Z',
  ...overrides
});

const lineItem = (overrides: Partial<LineItem> = {}): LineItem => ({
  Id: 5,
  RequestId: 42,
  RowNumber: 1,
  PurchaseDate: '2026-10-12',
  Vendor: 'Acme Lab Supply',
  Description: 'Pipette tips and centrifuge tubes',
  Category: 'R&D Materials & Supplies / Equipment',
  CategoryOther: null,
  CategoryConfirmedBy: null,
  Amount: 640,
  PaidBy: 'Company',
  NoQuoteReason: null,
  NoReceiptReason: null,
  SameReceiptAsRow: null,
  FileFingerprints: JSON.stringify([{ fileName: 'invoice.pdf', sizeBytes: 1200, fingerprint: 'abc', kind: 'receipt' }]),
  AttachmentFiles: [{ FileName: 'invoice.pdf', ServerRelativeUrl: '/sites/FormsAndApps/Lists/PurchaseRequestLines/Attachments/5/invoice.pdf' }],
  ...overrides
});

const submissionItem = (overrides: Partial<SubmissionItem> = {}): SubmissionItem => ({
  Id: 9,
  RequestId: 42,
  SubmissionType: 'Processing package',
  SubmissionNumber: 2,
  PackageStatus: 'Packaged',
  FolderName: '2026-10-12_Jane-Doe_Lab-supplies_PR-0042_R2',
  PreviousFolderName: '2026-10-12_Jane-Doe_Lab-supplies_PR-0042',
  SubmitterName: 'Jane Doe',
  SubmitterEmail: 'Jane.Doe@Example.com',
  CertificationText: CERTIFICATION,
  BusinessPurpose: 'Lab supplies for the Phase 1 assay',
  Department: 'R&D',
  ProjectCode: 'NSF SBIR Phase 1 (Award # 2528301)',
  PurchaseDates: '2026-10-12 to 2026-10-14',
  TotalReimburse: 25,
  TotalCompany: 640,
  TotalRequest: 665,
  ReceiptCount: 2,
  QuoteCount: 1,
  RowsWithoutReceipt: 0,
  BoughtBeforeApproval: true,
  ApprovedBy: 'Max Wamsley',
  ApprovedOn: '2026-10-15 10:05',
  EmailSubject: 'Purchase request resubmitted',
  EmailSummary: 'Summary text',
  FolderLink: 'Accounting > Purchases > Purchases_To_Process > 2026-10-12_Jane-Doe_Lab-supplies_PR-0042_R2',
  PackagedAt: '2026-10-16T14:35:00Z',
  ErrorMessage: null,
  Created: '2026-10-16T14:30:00Z',
  AttachmentFiles: [
    { FileName: 'R01_invoice.pdf', ServerRelativeUrl: '/a' },
    { FileName: 'PR-0042_R2_Purchases.csv', ServerRelativeUrl: '/b' }
  ],
  ...overrides
});

describe('list definitions (docs/DATA_MODEL.md)', () => {
  it('have the addresses, titles and marker from P-007', () => {
    expect(Object.values(LISTS).map((l) => [l.key, l.urlName, l.title])).toEqual([
      ['requests', 'PurchaseRequests', 'Purchase Requests'],
      ['lines', 'PurchaseRequestLines', 'Purchase Request Lines'],
      ['submissions', 'PurchaseSubmissions', 'Purchase Submissions']
    ]);
    expect(APP_LIST_MARKER).toBe('Purchase Requests app:');
    for (const list of Object.values(LISTS)) expect(list.description.startsWith(APP_LIST_MARKER)).toBe(true);
    expect(Object.values(LISTS).every((l) => l.urlName.startsWith('Purchase'))).toBe(true);
  });

  it('define every column in the data model for each list', () => {
    expect(LISTS.requests.fields.map((f) => f.name)).toEqual([
      'RequestNumber',
      'Department',
      'ProjectCode',
      'RequestStatus',
      'ReturnNote',
      'ReturnStage',
      'TotalReimburse',
      'TotalCompany',
      'TotalRequest',
      'SubmissionCount',
      'ApprovalRounds',
      'SentForApprovalOn',
      'BoughtBeforeApproval',
      'ApprovalRecord',
      'ApprovalNote',
      'ApprovedOn',
      'ApprovedBy',
      'SubmittedOn',
      'ProcessedOn',
      'ProcessedBy'
    ]);
    expect(LISTS.lines.fields.map((f) => f.name)).toEqual([
      'RequestId',
      'RowNumber',
      'PurchaseDate',
      'Vendor',
      'Description',
      'Category',
      'CategoryOther',
      'CategoryConfirmedBy',
      'Amount',
      'PaidBy',
      'NoQuoteReason',
      'NoReceiptReason',
      'SameReceiptAsRow',
      'FileFingerprints',
      'SuggestedFields'
    ]);
    expect(LISTS.submissions.fields.map((f) => f.name)).toEqual([
      'RequestId',
      'SubmissionType',
      'SubmissionNumber',
      'PackageStatus',
      'FolderName',
      'PreviousFolderName',
      'SubmitterName',
      'SubmitterEmail',
      'CertificationText',
      'BusinessPurpose',
      'Department',
      'ProjectCode',
      'PurchaseDates',
      'TotalReimburse',
      'TotalCompany',
      'TotalRequest',
      'ReceiptCount',
      'QuoteCount',
      'RowsWithoutReceipt',
      'BoughtBeforeApproval',
      'ApprovedBy',
      'ApprovedOn',
      'EmailSubject',
      'EmailSummary',
      'FolderLink',
      'PackagedAt',
      'ErrorMessage'
    ]);
    expect(LISTS.requests.titleDisplayName).toBe('Business purpose');
  });

  it('take their choices from the domain', () => {
    const choices = (list: keyof typeof LISTS, name: string) => LISTS[list].fields.find((f) => f.name === name)!.choices;
    expect(choices('requests', 'RequestStatus')).toEqual(REQUEST_STATUSES);
    expect(choices('requests', 'RequestStatus')).toEqual(['Draft', 'Awaiting approval', 'Approved', 'Submitted', 'Returned', 'Processed']);
    expect(choices('requests', 'ReturnStage')).toEqual(['Approval', 'Processing']);
    expect(choices('lines', 'Category')).toEqual(CATEGORIES.map((c) => c.label));
    expect(choices('lines', 'PaidBy')).toEqual(PAID_BY_OPTIONS.map((p) => p.label));
    expect(choices('lines', 'PaidBy')).toEqual(['Company', 'Employee']);
    expect(choices('submissions', 'PackageStatus')).toEqual(['Uploading', 'Ready', 'Processing', 'Packaged', 'Failed']);
    expect(PACKAGE_STATUSES).toEqual(['Uploading', 'Ready', 'Processing', 'Packaged', 'Failed']);
    expect(choices('submissions', 'SubmissionType')).toEqual(['Approval request', 'Processing package']);
  });

  it('have the defaults, indexes and identity columns the set-up page relies on', () => {
    const field = (list: keyof typeof LISTS, name: string) => LISTS[list].fields.find((f) => f.name === name)!;
    expect(field('requests', 'RequestStatus').defaultValue).toBe('Draft');
    expect(field('submissions', 'SubmissionType').defaultValue).toBe('Processing package');
    expect(field('submissions', 'PackageStatus').defaultValue).toBe('Uploading');
    expect(field('requests', 'BoughtBeforeApproval').defaultValue).toBe('0');
    const indexed = (list: keyof typeof LISTS) => LISTS[list].fields.filter((f) => f.indexed).map((f) => f.name);
    expect(indexed('requests')).toEqual(['RequestStatus']);
    expect(LISTS.requests.indexBuiltIn).toEqual(['Author']);
    expect(indexed('lines')).toEqual(['RequestId']);
    expect(indexed('submissions')).toEqual(['RequestId', 'PackageStatus']);
    expect(LISTS.requests.identityFields).toEqual(['RequestNumber', 'RequestStatus']);
    expect(LISTS.lines.identityFields).toEqual(['RequestId', 'RowNumber']);
    expect(LISTS.submissions.identityFields).toEqual(['RequestId', 'SubmissionNumber']);
  });

  it('store the approver as a person on the request and as frozen text on the submission', () => {
    const field = (list: keyof typeof LISTS, name: string) => LISTS[list].fields.find((f) => f.name === name)!;
    expect(field('requests', 'ApprovedBy').type).toBe('User');
    expect(field('requests', 'ApprovedOn').type).toBe('DateTime');
    expect(field('submissions', 'ApprovedBy').type).toBe('Text');
    expect(field('submissions', 'ApprovedOn').type).toBe('Text');
    expect(field('requests', 'ApprovalRecord').type).toBe('Note');
    expect(field('requests', 'BoughtBeforeApproval').type).toBe('Boolean');
  });

  it('write valid column definitions, escaping text', () => {
    const xml = fieldXml({
      name: 'Category',
      displayName: 'Category',
      type: 'Choice',
      choices: ['R&D Materials & Supplies / Equipment', 'Other'],
      defaultValue: 'Other',
      indexed: true
    });
    expect(xml).toBe(
      '<Field Type="Choice" DisplayName="Category" Name="Category" StaticName="Category" Required="FALSE" Indexed="TRUE" Format="Dropdown" FillInChoice="FALSE">' +
        '<Default>Other</Default><CHOICES><CHOICE>R&amp;D Materials &amp; Supplies / Equipment</CHOICE><CHOICE>Other</CHOICE></CHOICES></Field>'
    );
    expect(fieldXml({ name: 'Vendor', displayName: 'Vendor "name"', type: 'Text' })).toContain('DisplayName="Vendor &quot;name&quot;"');
    expect(fieldXml({ name: 'Vendor', displayName: 'Vendor', type: 'Text' })).toContain('MaxLength="255"');
    expect(fieldXml({ name: 'ApprovedBy', displayName: 'Approved by', type: 'User' })).toContain('Type="User"');
    expect(fieldXml({ name: 'BoughtBeforeApproval', displayName: 'Bought', type: 'Boolean', defaultValue: '0' })).toContain('<Default>0</Default>');
  });
});

describe('reading a request (anything may have been edited directly, travel D-002)', () => {
  it('converts a request, with money in whole cents and emails in lower case', () => {
    const r = requestFromItem(requestItem());
    expect(r).toMatchObject({
      id: 42,
      requestNumber: 'PR-0042',
      businessPurpose: 'Lab supplies for the Phase 1 assay',
      department: 'R&D',
      projectCode: 'NSF SBIR Phase 1 (Award # 2528301)',
      status: 'Approved',
      returnNote: '',
      returnStage: '',
      ownerName: 'Jane Doe',
      ownerEmail: 'jane.doe@example.com',
      submissionCount: 1,
      approvalRounds: 2,
      totalReimburseCents: 45230,
      totalCompanyCents: 30,
      totalRequestCents: 0,
      boughtBeforeApproval: true,
      approvalNote: 'OK, use the company card.',
      processedOn: '',
      processedBy: ''
    });
    expect(r.sentForApprovalOn).toBe(toLocalDateTime(new Date('2026-10-14T09:12:00Z')));
    expect(r.approvedOn).toBe(toLocalDateTime(new Date('2026-10-15T10:05:00Z')));
    expect(r.submittedOn).toBe(toLocalDateTime(new Date('2026-10-16T14:30:00Z')));
    expect(r.lastChanged).toBe(localTime('2026-10-16T14:30:00Z'));
  });

  it('makes the request number from the item ID, whatever the RequestNumber column holds', () => {
    // The column is only for people viewing the list: an employee can edit it, and it is empty if writing it failed.
    expect(requestFromItem(requestItem({ RequestNumber: 'PR-9999' })).requestNumber).toBe('PR-0042');
    expect(requestFromItem(requestItem({ RequestNumber: null })).requestNumber).toBe('PR-0042');
    expect(requestFromItem(requestItem({ Id: 7, RequestNumber: '<b>PR-0001</b>' })).requestNumber).toBe('PR-0007');
    expect(requestFromItem(requestItem({ Id: 12345 })).requestNumber).toBe('PR-12345');
  });

  it('reads who approved from the person column, with the email in lower case', () => {
    const r = requestFromItem(requestItem());
    expect(r.approvedBy).toBe('Max Wamsley');
    expect(r.approvedByEmail).toBe('max.wamsley@example.com');
    const none = requestFromItem(requestItem({ ApprovedBy: null, ApprovedOn: null }));
    expect([none.approvedBy, none.approvedByEmail, none.approvedOn]).toEqual(['', '', '']);
    expect(requestFromItem(requestItem({ ApprovedBy: { Title: 'Max Wamsley' } })).approvedByEmail).toBe('');
    expect(requestFromItem(requestItem({ ProcessedBy: { Title: 'Max Wamsley' } })).processedBy).toBe('Max Wamsley');
  });

  it('reads the stage a return came at', () => {
    expect(requestFromItem(requestItem({ ReturnStage: 'Approval' })).returnStage).toBe('approval');
    expect(requestFromItem(requestItem({ ReturnStage: 'Processing' })).returnStage).toBe('processing');
    expect(requestFromItem(requestItem({ ReturnStage: 'approval' })).returnStage).toBe('');
    expect(requestFromItem(requestItem({ ReturnStage: 'Something else' })).returnStage).toBe('');
    expect(requestFromItem(requestItem({ ReturnStage: null })).returnStage).toBe('');
  });

  it('treats unknown values safely', () => {
    const r = requestFromItem(
      requestItem({
        RequestStatus: 'Approved!',
        SubmissionCount: -3,
        ApprovalRounds: null,
        TotalReimburse: Number.NaN,
        BoughtBeforeApproval: 'yes' as unknown as boolean,
        SentForApprovalOn: 'not a date',
        Title: null
      })
    );
    expect(r.status).toBe('Draft');
    expect(r.submissionCount).toBe(0);
    expect(r.approvalRounds).toBe(0);
    expect(r.totalReimburseCents).toBe(0);
    expect(r.boughtBeforeApproval).toBe(false);
    expect(r.sentForApprovalOn).toBe('');
    expect(r.businessPurpose).toBe('');
    expect(requestFromItem(requestItem({ BoughtBeforeApproval: undefined })).boughtBeforeApproval).toBe(false);
  });

  it('reads every status the list offers', () => {
    for (const status of REQUEST_STATUSES) expect(requestFromItem(requestItem({ RequestStatus: status })).status).toBe(status);
  });
});

describe('the approval record (JSON on the request)', () => {
  const group = { key: 'acme lab supply', vendor: 'Acme Lab Supply', cents: 64000, bought: false };

  it('round trips what the app writes', () => {
    const record = { sent: [group, { key: 'line:5', vendor: '', cents: 70000, bought: true }], approved: [{ ...group, bought: true }] };
    expect(parseApprovalRecord(approvalRecordJson(record))).toEqual(record);
    expect(requestFromItem(requestItem({ ApprovalRecord: requestFields({ approval: record }).ApprovalRecord as string })).approval).toEqual(record);
  });

  it('reads an empty or missing record as nothing sent and nothing approved', () => {
    const empty = { sent: [], approved: [] };
    for (const value of [null, undefined, '', '{}', '{"sent":[],"approved":[]}']) expect(parseApprovalRecord(value)).toEqual(empty);
    expect(parseApprovalRecord('{"approved":[' + JSON.stringify(group) + ']}')).toEqual({ sent: [], approved: [group] });
  });

  it('reads bad JSON and wrong shapes as the empty record', () => {
    const empty = { sent: [], approved: [] };
    for (const value of ['{not json', 'null', '42', '"text"', '[1,2]', '[]', '{"sent":"x","approved":[]}', '{"sent":[],"approved":{"a":1}}']) {
      expect(parseApprovalRecord(value)).toEqual(empty);
    }
    // One bad half makes the whole record untrustworthy, so a good half next to it is not kept either.
    expect(parseApprovalRecord(JSON.stringify({ sent: 'x', approved: [group] }))).toEqual(empty);
  });

  it('drops a vendor total that is not well formed, and keeps the good ones', () => {
    const record = {
      sent: [
        group,
        { key: 5, vendor: 'Acme', cents: 1000, bought: false },
        { key: 'a', vendor: 7, cents: 1000, bought: false },
        { key: 'b', vendor: 'B', cents: '1000', bought: false },
        { key: 'c', vendor: 'C', cents: -1, bought: false },
        { key: 'd', vendor: 'D', cents: null, bought: false },
        { key: 'e', vendor: 'E' },
        'junk',
        null
      ],
      approved: [{ key: 'f', vendor: 'F', cents: 0, bought: false }]
    };
    expect(parseApprovalRecord(JSON.stringify(record))).toEqual({ sent: [group], approved: [{ key: 'f', vendor: 'F', cents: 0, bought: false }] });
  });

  it('reads bought as true only when it is exactly true', () => {
    const read = (bought: unknown) => parseApprovalRecord(JSON.stringify({ sent: [{ ...group, bought }], approved: [] })).sent[0].bought;
    expect(read(true)).toBe(true);
    for (const value of [false, 'true', 1, 'yes', null, [true], undefined]) expect(read(value)).toBe(false);
  });

  it('keeps whole cents', () => {
    expect(parseApprovalRecord(JSON.stringify({ sent: [{ ...group, cents: 64000.4 }], approved: [] })).sent[0].cents).toBe(64000);
    // 1e309 is read as Infinity, which is not an amount.
    expect(parseApprovalRecord('{"sent":[{"key":"a","vendor":"A","cents":1e309,"bought":false}],"approved":[]}').sent).toEqual([]);
  });

  it('writes only the two lists', () => {
    const json = approvalRecordJson({ sent: [group], approved: [] });
    expect(JSON.parse(json)).toEqual({ sent: [group], approved: [] });
    expect(JSON.parse(approvalRecordJson({ sent: [], approved: [], extra: 1 } as never))).toEqual({ sent: [], approved: [] });
  });
});

describe('reading a row and its files', () => {
  it('converts a row, its files and their kinds', () => {
    const l = lineFromItem(lineItem());
    expect(l).toMatchObject({
      id: '5',
      requestId: 42,
      rowNumber: 1,
      date: '2026-10-12',
      vendor: 'Acme Lab Supply',
      description: 'Pipette tips and centrifuge tubes',
      category: 'rdMaterials',
      categoryOther: '',
      categoryConfirmedBy: '',
      amountCents: 64000,
      paidBy: 'company',
      noQuoteReason: '',
      noReceiptReason: '',
      sameReceiptAsRow: null,
      suggested: []
    });
    expect(l.files).toEqual([
      {
        id: 'invoice.pdf',
        fileName: 'invoice.pdf',
        sizeBytes: 1200,
        fingerprint: 'abc',
        contentType: 'application/pdf',
        kind: 'receipt',
        url: '/sites/FormsAndApps/Lists/PurchaseRequestLines/Attachments/5/invoice.pdf'
      }
    ]);
  });

  it('reads every category and both ways of having paid by their labels', () => {
    for (const c of CATEGORIES) expect(lineFromItem(lineItem({ Category: c.label })).category).toBe(c.id);
    expect(lineFromItem(lineItem({ PaidBy: 'Employee' })).paidBy).toBe('employee');
    expect(lineFromItem(lineItem({ Category: 'Other', CategoryOther: 'Lab safety audit', CategoryConfirmedBy: 'Max Wamsley' }))).toMatchObject({
      category: 'other',
      categoryOther: 'Lab safety audit',
      categoryConfirmedBy: 'Max Wamsley'
    });
  });

  it('treats unknown values safely', () => {
    const l = lineFromItem(
      lineItem({
        Category: 'Snacks',
        PaidBy: 'Somebody',
        Amount: null,
        SameReceiptAsRow: -3,
        FileFingerprints: '{not json',
        RowNumber: -2,
        PurchaseDate: null,
        Vendor: null
      })
    );
    expect(l.category).toBe('');
    expect(l.paidBy).toBe('');
    expect(l.amountCents).toBeNull();
    expect(l.sameReceiptAsRow).toBeNull();
    expect(l.rowNumber).toBe(0);
    expect([l.date, l.vendor]).toEqual(['', '']);
    expect(l.files[0].fingerprint).toBe('');
    // With no record of the file, it is not taken for a receipt.
    expect(l.files[0].kind).toBe('quote');
    // A label in the wrong case, or the app's own id, is not a choice.
    expect(lineFromItem(lineItem({ Category: 'office supplies' })).category).toBe('');
    expect(lineFromItem(lineItem({ Category: 'office' })).category).toBe('');
    expect(lineFromItem(lineItem({ PaidBy: 'company' })).paidBy).toBe('');
    expect(lineFromItem(lineItem({ Amount: Number.POSITIVE_INFINITY })).amountCents).toBeNull();
  });

  it('reads the kind of each file from the stored fingerprints (P-021)', () => {
    const prints = [
      { fileName: 'quote.pdf', sizeBytes: 10, fingerprint: 'q', kind: 'quote' },
      { fileName: 'invoice.pdf', sizeBytes: 20, fingerprint: 'r', kind: 'receipt' }
    ];
    const l = lineFromItem(
      lineItem({
        FileFingerprints: JSON.stringify(prints),
        AttachmentFiles: [
          { FileName: 'quote.pdf', ServerRelativeUrl: '/q' },
          { FileName: 'invoice.pdf', ServerRelativeUrl: '/r' }
        ]
      })
    );
    expect(l.files.map((f) => [f.fileName, f.kind])).toEqual([
      ['quote.pdf', 'quote'],
      ['invoice.pdf', 'receipt']
    ]);
  });

  it('reads a file with no stored kind, or an unknown kind, as a quote, so a missing record never counts as the receipt (P-021)', () => {
    const prints = [
      { fileName: 'old.pdf', sizeBytes: 10, fingerprint: 'o' },
      { fileName: 'odd.pdf', sizeBytes: 10, fingerprint: 'p', kind: 'invoice' },
      { fileName: 'num.pdf', sizeBytes: 10, fingerprint: 'n', kind: 7 },
      { fileName: 'null.pdf', sizeBytes: 10, fingerprint: 'l', kind: null },
      { fileName: 'caps.pdf', sizeBytes: 10, fingerprint: 'c', kind: 'Receipt' }
    ];
    expect(parseFingerprints(JSON.stringify(prints)).map((p) => p.kind)).toEqual(['quote', 'quote', 'quote', 'quote', 'quote']);
    expect(parseFingerprints(JSON.stringify([{ fileName: 'r.pdf', kind: 'receipt' }])).map((p) => p.kind)).toEqual(['receipt']);
    const l = lineFromItem(
      lineItem({
        FileFingerprints: JSON.stringify(prints),
        AttachmentFiles: prints
          .map((p) => ({ FileName: p.fileName, ServerRelativeUrl: `/${p.fileName}` }))
          .concat([{ FileName: 'direct.pdf', ServerRelativeUrl: '/direct.pdf' }])
      })
    );
    // A file added directly in SharePoint has no stored entry: a quote, with no fingerprint.
    expect(l.files.map((f) => f.kind)).toEqual(['quote', 'quote', 'quote', 'quote', 'quote', 'quote']);
    expect(l.files[5]).toMatchObject({ fileName: 'direct.pdf', fingerprint: '', sizeBytes: 0 });
  });

  it('keeps fingerprints and kinds when a row is read without its attachments', () => {
    const prints = [
      { fileName: 'quote.pdf', sizeBytes: 10, fingerprint: 'q', kind: 'quote' },
      { fileName: 'invoice.pdf', sizeBytes: 20, fingerprint: 'r', kind: 'receipt' }
    ];
    const l = lineFromItem(lineItem({ FileFingerprints: JSON.stringify(prints), AttachmentFiles: undefined }));
    expect(l.files.map((f) => [f.fileName, f.fingerprint, f.kind, f.url])).toEqual([
      ['quote.pdf', 'q', 'quote', undefined],
      ['invoice.pdf', 'r', 'receipt', undefined]
    ]);
  });

  it('keeps the files in the order they were added, whatever order SharePoint lists them in', () => {
    const prints = ['b.pdf', 'a.pdf', 'c.pdf'].map((fileName) => ({ fileName, sizeBytes: 1, fingerprint: fileName, kind: 'receipt' }));
    const l = lineFromItem(
      lineItem({
        FileFingerprints: JSON.stringify(prints),
        AttachmentFiles: ['a.pdf', 'c.pdf', 'extra.pdf', 'b.pdf'].map((FileName) => ({ FileName, ServerRelativeUrl: `/${FileName}` }))
      })
    );
    expect(l.files.map((f) => f.fileName)).toEqual(['b.pdf', 'a.pdf', 'c.pdf', 'extra.pdf']);
  });

  it('reads stored fingerprints defensively', () => {
    expect(parseFingerprints(null)).toEqual([]);
    expect(parseFingerprints('')).toEqual([]);
    expect(parseFingerprints('{"fileName":"a.pdf"}')).toEqual([]);
    expect(parseFingerprints('[1, {"fileName": 3}, null, "x"]')).toEqual([]);
    expect(parseFingerprints('[{"fileName":"a.pdf","sizeBytes":"big","fingerprint":7}]')).toEqual([
      { fileName: 'a.pdf', sizeBytes: 0, fingerprint: '7', kind: 'quote' }
    ]);
  });

  it('reads unconfirmed suggestions, dropping anything unknown (travel D-078)', () => {
    expect(lineFromItem(lineItem()).suggested).toEqual([]);
    expect(lineFromItem(lineItem({ SuggestedFields: ' amount, date,<b>x</b>,amount' })).suggested).toEqual(['date', 'amount']);
    expect(lineFromItem(lineItem({ SuggestedFields: 'paidBy,vendor' })).suggested).toEqual(['vendor', 'paidBy']);
    expect(parseSuggested(null)).toEqual([]);
  });

  it('gives the content type of the files the app accepts', () => {
    expect([
      contentTypeFor('a.PDF'),
      contentTypeFor('b.png'),
      contentTypeFor('c.JPEG'),
      contentTypeFor('d.heic'),
      contentTypeFor('e.csv'),
      contentTypeFor('f')
    ]).toEqual(['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'text/csv', 'application/octet-stream']);
  });
});

describe('reading a submission', () => {
  it('converts an item, with its files and the request number given', () => {
    const s = submissionFromItem(submissionItem(), 'PR-0042');
    expect(s).toMatchObject({
      id: 9,
      requestId: 42,
      requestNumber: 'PR-0042',
      type: 'package',
      submissionNumber: 2,
      packageStatus: 'Packaged',
      submitterName: 'Jane Doe',
      submitterEmail: 'jane.doe@example.com',
      certificationText: CERTIFICATION,
      businessPurpose: 'Lab supplies for the Phase 1 assay',
      department: 'R&D',
      purchaseDates: '2026-10-12 to 2026-10-14',
      totalReimburseCents: 2500,
      totalCompanyCents: 64000,
      totalRequestCents: 66500,
      receiptCount: 2,
      quoteCount: 1,
      rowsWithoutReceipt: 0,
      boughtBeforeApproval: true,
      approvedBy: 'Max Wamsley',
      approvedOn: '2026-10-15 10:05',
      errorMessage: '',
      packageFileNames: ['R01_invoice.pdf', 'PR-0042_R2_Purchases.csv']
    });
    expect(s.submittedOn).toBe(localTime('2026-10-16T14:30:00Z'));
    expect(s.packagedAt).toBe(localTime('2026-10-16T14:35:00Z'));
  });

  it('reads the type from its choice, and an unknown or empty type as a package', () => {
    expect(SUBMISSION_TYPE_LABELS).toEqual({ approval: 'Approval request', package: 'Processing package' });
    expect(submissionFromItem(submissionItem({ SubmissionType: 'Approval request' }), 'PR-0042').type).toBe('approval');
    expect(submissionFromItem(submissionItem({ SubmissionType: 'Processing package' }), 'PR-0042').type).toBe('package');
    for (const value of [null, '', 'approval', 'Approval', 'Something'])
      expect(submissionFromItem(submissionItem({ SubmissionType: value }), 'PR-0042').type).toBe('package');
  });

  it('reads every package status, and an unknown one as Uploading', () => {
    for (const status of PACKAGE_STATUSES) expect(submissionFromItem(submissionItem({ PackageStatus: status }), 'PR-0042').packageStatus).toBe(status);
    expect(submissionFromItem(submissionItem({ PackageStatus: 'Done' }), 'PR-0042').packageStatus).toBe('Uploading');
  });

  it('reads an item with nothing filled in by the flow yet', () => {
    const s = submissionFromItem(
      submissionItem({ FolderLink: null, PackagedAt: null, ErrorMessage: null, AttachmentFiles: undefined, BoughtBeforeApproval: null }),
      'PR-0042'
    );
    expect([s.folderLink, s.packagedAt, s.errorMessage, s.packageFileNames, s.boughtBeforeApproval]).toEqual(['', '', '', [], false]);
  });
});

describe('writing changes', () => {
  it('writes a request change as columns: the purpose is the Title, cut to one line of text', () => {
    expect(requestFields({ businessPurpose: 'Lab supplies', department: 'R&D', projectCode: 'NSF' })).toEqual({
      Title: 'Lab supplies',
      Department: 'R&D',
      ProjectCode: 'NSF'
    });
    expect(requestFields({})).toEqual({});
    expect((requestFields({ businessPurpose: 'x'.repeat(300) }).Title as string).length).toBe(255);
    expect((requestFields({ department: 'd'.repeat(300), projectCode: 'p'.repeat(300) }).Department as string).length).toBe(255);
  });

  it('writes the status, the return note and stage, and clears the stage with an empty one', () => {
    expect(requestFields({ status: 'Returned', returnNote: 'Add the invoice.', returnStage: 'processing' })).toEqual({
      RequestStatus: 'Returned',
      ReturnNote: 'Add the invoice.',
      ReturnStage: RETURN_STAGE_LABELS.processing
    });
    expect(requestFields({ returnStage: 'approval' })).toEqual({ ReturnStage: 'Approval' });
    expect(requestFields({ returnStage: '' })).toEqual({ ReturnStage: null });
  });

  it('writes totals in dollars, counts, the flag and the approval record', () => {
    const approval = { sent: [{ key: 'acme', vendor: 'Acme', cents: 64000, bought: true }], approved: [] };
    expect(
      requestFields({
        totalReimburseCents: 45230,
        totalCompanyCents: 30,
        totalRequestCents: 45260,
        submissionCount: 2,
        approvalRounds: 3,
        boughtBeforeApproval: true,
        approval,
        approvalNote: 'OK'
      })
    ).toEqual({
      TotalReimburse: 452.3,
      TotalCompany: 0.3,
      TotalRequest: 452.6,
      SubmissionCount: 2,
      ApprovalRounds: 3,
      BoughtBeforeApproval: true,
      ApprovalRecord: JSON.stringify(approval),
      ApprovalNote: 'OK'
    });
  });

  it('writes the times as given and the people by user ID, and null clears them', () => {
    expect(
      requestFields({
        sentForApprovalOn: '2026-10-14T09:12:00.000Z',
        approvedOn: '2026-10-15T10:05:00.000Z',
        approvedById: 7,
        submittedOn: '2026-10-16T14:30:00.000Z',
        processedOn: '2026-10-20T08:00:00.000Z',
        processedById: 7
      })
    ).toEqual({
      SentForApprovalOn: '2026-10-14T09:12:00.000Z',
      ApprovedOn: '2026-10-15T10:05:00.000Z',
      ApprovedById: 7,
      SubmittedOn: '2026-10-16T14:30:00.000Z',
      ProcessedOn: '2026-10-20T08:00:00.000Z',
      ProcessedById: 7
    });
    expect(requestFields({ approvedOn: null, approvedById: null })).toEqual({ ApprovedOn: null, ApprovedById: null });
  });

  it('never writes a column that was not asked for', () => {
    expect(Object.keys(requestFields({ department: 'R&D' }))).toEqual(['Department']);
    expect(requestFields({ businessPurpose: undefined, status: undefined })).toEqual({});
  });

  it('sends only the changed row columns, with choice labels and dollars', () => {
    expect(lineFields({ category: 'office', amountCents: 4210, paidBy: 'employee' })).toEqual({
      Category: 'Office Supplies',
      Amount: 42.1,
      PaidBy: 'Employee'
    });
    expect(lineFields({ category: 'rdMaterials' })).toEqual({ Category: 'R&D Materials & Supplies / Equipment' });
    expect(lineFields({ category: '', amountCents: null, paidBy: '' })).toEqual({ Category: null, Amount: null, PaidBy: null });
    expect(lineFields({ suggested: ['vendor', 'date'] })).toEqual({ SuggestedFields: 'date,vendor' });
    expect(lineFields({ suggested: [] })).toEqual({ SuggestedFields: '' });
    expect(lineFields({ date: '2026-10-12', noQuoteReason: 'Sole supplier', noReceiptReason: 'Lost', sameReceiptAsRow: 2 })).toEqual({
      PurchaseDate: '2026-10-12',
      NoQuoteReason: 'Sole supplier',
      NoReceiptReason: 'Lost',
      SameReceiptAsRow: 2
    });
    expect(lineFields({ categoryOther: 'Lab safety audit', categoryConfirmedBy: 'Max Wamsley' })).toEqual({
      CategoryOther: 'Lab safety audit',
      CategoryConfirmedBy: 'Max Wamsley'
    });
  });

  it('cuts one-line text to 255 characters', () => {
    const long = 'x'.repeat(300);
    const columns = lineFields({ vendor: long, description: long, categoryOther: long, categoryConfirmedBy: long, noQuoteReason: long, noReceiptReason: long });
    for (const value of Object.values(columns)) expect((value as string).length).toBe(255);
  });

  it('writes the fingerprints with each file kind', () => {
    expect(storedFingerprint(quote({ fileName: 'q.pdf', sizeBytes: 5, fingerprint: 'qq' }))).toEqual({
      fileName: 'q.pdf',
      sizeBytes: 5,
      fingerprint: 'qq',
      kind: 'quote'
    });
    expect(storedFingerprint(file({ fileName: 'r.pdf', sizeBytes: 6, fingerprint: 'rr' }))).toEqual({
      fileName: 'r.pdf',
      sizeBytes: 6,
      fingerprint: 'rr',
      kind: 'receipt'
    });
    const stored = JSON.stringify([quote(), file()].map(storedFingerprint));
    expect(parseFingerprints(stored).map((p) => p.kind)).toEqual(['quote', 'receipt']);
  });

  it('converts between cents and dollars without rounding errors', () => {
    expect(centsToDollars(45230)).toBe(452.3);
    expect(centsToDollars(10)).toBe(0.1);
    expect(centsToDollars(1)).toBe(0.01);
    expect(centsToDollars(0.4)).toBe(0);
  });
});

describe('writing a submission', () => {
  const now = new Date(2026, 9, 16, 9, 30);
  const jane = { name: 'Jane Doe', email: 'jane.doe@example.com' };
  const big = line({ id: 'big', vendor: 'Acme Lab Supply', amountCents: 100000, date: '2026-10-20', files: [quote()] });

  it('writes the columns of an approval request, titled "approval"', () => {
    const fields = submissionFields(prepareApprovalRequest(request(), [big], [], now, jane, 2).submission);
    expect(fields).toMatchObject({
      Title: 'PR-0042 approval 2',
      RequestId: 42,
      SubmissionType: 'Approval request',
      SubmissionNumber: 2,
      PackageStatus: 'Uploading',
      FolderName: '',
      PreviousFolderName: '',
      SubmitterName: 'Jane Doe',
      SubmitterEmail: 'jane.doe@example.com',
      CertificationText: '',
      BusinessPurpose: 'Lab supplies for the Phase 1 assay',
      Department: 'R&D',
      PurchaseDates: '2026-10-20',
      TotalReimburse: 0,
      TotalCompany: 1000,
      TotalRequest: 1000,
      ReceiptCount: 0,
      QuoteCount: 1,
      RowsWithoutReceipt: 0,
      BoughtBeforeApproval: false,
      ApprovedBy: '',
      ApprovedOn: ''
    });
    expect(fields.EmailSubject).toContain('Purchase approval needed again');
    expect(String(fields.EmailSummary)).toContain('Needs your approval');
    // Only what the app writes: the flow fills in the folder link, the time packaged and any error.
    expect(Object.keys(fields)).not.toEqual(expect.arrayContaining(['FolderLink', 'PackagedAt', 'ErrorMessage']));
  });

  it('writes the columns of a package, titled "submission", with the frozen approval as text', () => {
    const approved = request({
      status: 'Approved',
      approval: { sent: [], approved: [{ key: vendorKey('Acme Lab Supply'), vendor: 'Acme Lab Supply', cents: 100000, bought: true }] },
      boughtBeforeApproval: true,
      approvedBy: 'Max Wamsley',
      approvedByEmail: 'max.wamsley@example.com',
      approvedOn: '2026-10-14 10:05',
      submissionCount: 1
    });
    const prepared = prepareSubmission(
      approved,
      [line({ id: 'big', vendor: 'Acme Lab Supply', amountCents: 100000, files: [quote(), file()] })],
      [],
      now,
      'earlier-folder',
      {
        text: CERTIFICATION,
        email: 'jane.doe@example.com'
      }
    );
    const fields = submissionFields(prepared.submission);
    expect(fields).toMatchObject({
      Title: 'PR-0042 submission 2',
      SubmissionType: 'Processing package',
      SubmissionNumber: 2,
      PackageStatus: 'Uploading',
      PreviousFolderName: 'earlier-folder',
      CertificationText: CERTIFICATION,
      ReceiptCount: 1,
      QuoteCount: 1,
      BoughtBeforeApproval: true,
      ApprovedBy: 'Max Wamsley',
      ApprovedOn: '2026-10-14 10:05'
    });
    expect(String(fields.FolderName)).toMatch(/_PR-0042_R2$/);
  });

  it('cuts one-line text to 255 characters, but not the long texts', () => {
    const prepared = prepareApprovalRequest(request({ businessPurpose: 'p'.repeat(400) }), [big], [], now, jane, 1);
    const fields = submissionFields(prepared.submission);
    expect(String(fields.BusinessPurpose).length).toBe(255);
    expect(String(fields.Title).length).toBeLessThanOrEqual(255);
    expect(String(fields.EmailSummary).length).toBeGreaterThan(400);
  });

  it('round trips through the item the list would hold', () => {
    const fields = submissionFields(prepareApprovalRequest(request(), [big], [], now, jane, 1).submission);
    const s = submissionFromItem(
      { ...submissionItem(), ...(fields as Partial<SubmissionItem>), Id: 3, PackageStatus: 'Ready', Created: '2026-10-16T14:30:00Z', AttachmentFiles: [] },
      'PR-0042'
    );
    expect(s).toMatchObject({
      id: 3,
      requestId: 42,
      type: 'approval',
      submissionNumber: 1,
      packageStatus: 'Ready',
      submitterEmail: 'jane.doe@example.com',
      totalCompanyCents: 100000,
      quoteCount: 1,
      packageFileNames: []
    });
  });
});

describe('dates and times', () => {
  it('shows a stored time as local "YYYY-MM-DD HH:MM", and nothing for a missing or bad one', () => {
    expect(localTime('2026-10-16T14:30:00Z')).toBe(toLocalDateTime(new Date('2026-10-16T14:30:00Z')));
    expect(localTime('2026-10-16T14:30:00Z')).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d$/);
    expect(localTime(null)).toBe('');
    expect(localTime(undefined)).toBe('');
    expect(localTime('')).toBe('');
    expect(localTime('yesterday')).toBe('');
  });
});
