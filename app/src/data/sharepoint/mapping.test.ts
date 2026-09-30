import { fieldXml, LISTS } from './schema';
import { lineFields, lineFromItem, LineItem, parseFingerprints, parseSuggested, reportFields, reportFromItem, ReportItem } from './mapping';

const reportItem = (overrides: Partial<ReportItem> = {}): ReportItem => ({
  Id: 42,
  Title: 'Boston Conference',
  ReportNumber: 'TR-0042',
  Destination: 'Boston, MA',
  BusinessPurpose: 'Present results',
  TripPurpose: 'NSF Phase I project work',
  TripStart: '2026-10-12',
  TripEnd: '2026-10-15',
  ReportStatus: 'Submitted',
  ReturnNote: null,
  TotalReimburse: 452.3,
  TotalCompany: 0.1 + 0.2,
  TotalTrip: null,
  SubmissionCount: 1,
  SubmittedOn: '2026-10-16T14:30:00Z',
  ProcessedOn: null,
  Author: { Title: 'Jane Doe', EMail: 'Jane.Doe@Example.com' },
  Modified: '2026-10-16T14:30:00Z',
  ...overrides
});

const lineItem = (overrides: Partial<LineItem> = {}): LineItem => ({
  Id: 5,
  ReportId: 42,
  RowNumber: 1,
  ExpenseDate: '2026-10-12',
  Vendor: 'Skyway Airlines',
  Category: 'Airfare',
  Description: null,
  Amount: 452.3,
  PaymentType: 'Company card',
  NoReceiptReason: null,
  SameReceiptAsRow: null,
  FileFingerprints: JSON.stringify([{ fileName: 'ticket.pdf', sizeBytes: 1200, fingerprint: 'abc' }]),
  AttachmentFiles: [{ FileName: 'ticket.pdf', ServerRelativeUrl: '/sites/Travel/Lists/TravelExpenseLines/Attachments/5/ticket.pdf' }],
  ...overrides
});

describe('list definitions', () => {
  it('define every column in docs/DATA_MODEL.md for each list', () => {
    expect(LISTS.reports.fields.map((f) => f.name)).toContain('ReportStatus');
    expect(LISTS.lines.fields.find((f) => f.name === 'ReportId')!.indexed).toBe(true);
    expect(LISTS.submissions.fields.map((f) => f.name)).toEqual(expect.arrayContaining(['SubmitterEmail', 'CertificationText', 'PackageStatus']));
  });

  it('write valid column definitions, escaping text', () => {
    const xml = fieldXml({
      name: 'Category',
      displayName: 'Category',
      type: 'Choice',
      choices: ['Meals & drinks', 'Other'],
      defaultValue: 'Other',
      indexed: true
    });
    expect(xml).toBe(
      '<Field Type="Choice" DisplayName="Category" Name="Category" StaticName="Category" Required="FALSE" Indexed="TRUE" Format="Dropdown" FillInChoice="FALSE">' +
        '<Default>Other</Default><CHOICES><CHOICE>Meals &amp; drinks</CHOICE><CHOICE>Other</CHOICE></CHOICES></Field>'
    );
    expect(fieldXml({ name: 'Vendor', displayName: 'Vendor "name"', type: 'Text' })).toContain('DisplayName="Vendor &quot;name&quot;"');
    expect(fieldXml({ name: 'Vendor', displayName: 'Vendor', type: 'Text' })).toContain('MaxLength="255"');
  });
});

describe('reading stored items (anything may have been edited directly, D-002)', () => {
  it('converts a report, with money in whole cents and emails in lower case', () => {
    const r = reportFromItem(reportItem());
    expect(r.tripPurpose).toBe('nsfPhase1');
    expect(r.status).toBe('Submitted');
    expect(r.totalReimburseCents).toBe(45230);
    expect(r.totalCompanyCents).toBe(30);
    expect(r.totalTripCents).toBe(0);
    expect(r.ownerEmail).toBe('jane.doe@example.com');
    expect(r.returnNote).toBe('');
    expect(r.submittedOn).toMatch(/^2026-10-16 \d\d:30$/);
  });

  it('treats unknown values safely', () => {
    const r = reportFromItem(reportItem({ ReportStatus: 'Approved!', TripPurpose: 'Something else' }));
    expect(r.status).toBe('Draft');
    expect(r.tripPurpose).toBe('');
    const l = lineFromItem(lineItem({ Category: 'Snacks', PaymentType: null, Amount: null, SameReceiptAsRow: -3, FileFingerprints: '{not json' }));
    expect(l.category).toBe('');
    expect(l.paymentType).toBe('');
    expect(l.amountCents).toBeNull();
    expect(l.sameReceiptAsRow).toBeNull();
    expect(l.receipts[0].fingerprint).toBe('');
    expect(parseFingerprints('[1, {"fileName": 3}]')).toEqual([]);
  });

  it('converts a row and its receipts', () => {
    const l = lineFromItem(lineItem());
    expect(l.id).toBe('5');
    expect(l.category).toBe('airfare');
    expect(l.paymentType).toBe('companyCard');
    expect(l.amountCents).toBe(45230);
    expect(l.receipts).toEqual([
      {
        id: 'ticket.pdf',
        fileName: 'ticket.pdf',
        sizeBytes: 1200,
        fingerprint: 'abc',
        contentType: 'application/pdf',
        url: '/sites/Travel/Lists/TravelExpenseLines/Attachments/5/ticket.pdf'
      }
    ]);
  });

  it('keeps fingerprints when a row is read without its attachments', () => {
    const l = lineFromItem(lineItem({ AttachmentFiles: undefined }));
    expect(l.receipts.map((r) => r.fingerprint)).toEqual(['abc']);
  });

  it('reads unconfirmed suggestions, dropping anything unknown (D-078)', () => {
    expect(lineFromItem(lineItem()).suggested).toEqual([]);
    expect(lineFromItem(lineItem({ SuggestedFields: ' amount, date,<b>x</b>,amount' })).suggested).toEqual(['date', 'amount']);
    expect(parseSuggested(null)).toEqual([]);
  });
});

describe('writing changes', () => {
  it('sends only the changed columns, with choice labels and dollars', () => {
    expect(reportFields({ tripPurpose: 'commercial' })).toEqual({ TripPurpose: 'Customer or commercial work' });
    expect(lineFields({ category: 'meals', amountCents: 4210, paymentType: 'personal' })).toEqual({
      Category: 'Meals',
      Amount: 42.1,
      PaymentType: 'Personal card or cash (reimburse me)'
    });
    expect(lineFields({ category: '', amountCents: null })).toEqual({ Category: null, Amount: null });
    expect(lineFields({ suggested: ['vendor', 'date'] })).toEqual({ SuggestedFields: 'date,vendor' });
    expect(lineFields({ suggested: [] })).toEqual({ SuggestedFields: '' });
  });
});

describe('mileage stored with a report (D-071)', () => {
  it('reads the drives defensively', () => {
    const trips = JSON.stringify([{ id: 'a', date: '2026-10-12', from: 'Office', to: 'Airport', miles: 42.26 }, { from: 'x', miles: -3 }, 'junk']);
    const r = reportFromItem(reportItem({ HasMileage: true, MileageTrips: trips }));
    expect(r.hasMileage).toBe(true);
    expect(r.mileageTrips).toEqual([
      { id: 'a', date: '2026-10-12', from: 'Office', to: 'Airport', miles: 42.3 },
      { id: 'trip-2', date: '', from: 'x', to: '', miles: null }
    ]);
    expect(reportFromItem(reportItem({ HasMileage: null, MileageTrips: 'not json' }))).toMatchObject({ hasMileage: false, mileageTrips: [] });
  });

  it('writes the switch and the drives', () => {
    const trips = [{ id: 'a', date: '2026-10-12', from: 'Office', to: 'Airport', miles: 42 }];
    expect(reportFields({ hasMileage: true, mileageTrips: trips })).toEqual({ HasMileage: true, MileageTrips: JSON.stringify(trips) });
  });
});
