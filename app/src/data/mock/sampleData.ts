// Synthetic sample data for the prototype and tests. People, vendors and
// receipts are made up (see test/fixtures/receipts). No real data.

import { computeTotals } from '../../domain/totals';
import { activeTrips } from '../../domain/mileage';
import { csvFileName, packageReceipts } from '../../domain/naming';
import { messages } from '../../domain/messages';
import { validateReport } from '../../domain/validation';
import { buildExpensesCsv } from '../../export/csv';
import { buildEmailSummary, emailSubject } from '../../export/email';
import { CurrentUser, ExpenseLine, ReceiptFile, Submission, TravelReport } from '../../domain/types';

export const SAMPLE_USERS: Record<'jane' | 'sam' | 'admin', CurrentUser> = {
  jane: { displayName: 'Jane Doe', email: 'jane.doe@example.com', isAdministrator: false },
  sam: { displayName: 'Sam Lee', email: 'sam.lee@example.com', isAdministrator: false },
  admin: { displayName: 'Max Wamsley', email: 'max.wamsley@example.com', isAdministrator: true }
};

function file(id: string, fileName: string, sizeBytes: number, fingerprint: string): ReceiptFile {
  const contentType = fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png';
  return { id, fileName, sizeBytes, fingerprint, contentType, url: `/receipts/${fileName}` };
}

const FILES = {
  skyway: () => file('f-skyway', 'skyway-airlines-eticket.pdf', 36058, 'sample-skyway'),
  conference: () => file('f-conf', 'northeast-science-conference-registration.pdf', 34101, 'sample-conference'),
  hotel: () => file('f-hotel', 'harbor-view-hotel-folio.pdf', 35786, 'sample-hotel'),
  cab: () => file('f-cab', 'city-cab-receipt.png', 40235, 'sample-cab'),
  bistro: () => file('f-bistro', 'blue-door-bistro.png', 42557, 'sample-bistro'),
  parking: () => file('f-parking', 'metro-parking.png', 42265, 'sample-parking')
};

function report(r: Partial<TravelReport> & Pick<TravelReport, 'id' | 'tripName' | 'ownerName' | 'ownerEmail'>): TravelReport {
  return {
    reportNumber: `TR-${String(r.id).padStart(4, '0')}`,
    destination: '',
    businessPurpose: '',
    tripPurpose: '',
    tripStart: '',
    tripEnd: '',
    hasMileage: false,
    mileageTrips: [],
    status: 'Draft',
    returnNote: '',
    submissionCount: 0,
    totalReimburseCents: 0,
    totalCompanyCents: 0,
    totalTripCents: 0,
    submittedOn: '',
    processedOn: '',
    processedBy: '',
    lastChanged: '2026-09-20 10:00',
    ...r
  };
}

let lineCounter = 0;
function row(reportId: number, rowNumber: number, l: Partial<ExpenseLine>): ExpenseLine {
  lineCounter += 1;
  return {
    id: `sample-${lineCounter}`,
    reportId,
    rowNumber,
    date: '',
    vendor: '',
    category: '',
    description: '',
    amountCents: null,
    paymentType: '',
    noReceiptReason: '',
    sameReceiptAsRow: null,
    receipts: [],
    suggested: [],
    ...l
  };
}

export interface SampleStore {
  reports: TravelReport[];
  lines: ExpenseLine[];
  submissions: Submission[];
  csvBySubmission: Record<number, string>;
  nextReportId: number;
  nextSubmissionId: number;
}

export function createSampleStore(): SampleStore {
  lineCounter = 0;
  const jane = SAMPLE_USERS.jane;
  const sam = SAMPLE_USERS.sam;

  const reports: TravelReport[] = [
    report({
      id: 41,
      tripName: 'Boston Conference',
      destination: 'Boston, MA',
      businessPurpose: 'Present Phase I results at the Northeast Science Conference and meet two potential partners.',
      tripPurpose: 'nsfPhase1',
      tripStart: '2026-09-14',
      tripEnd: '2026-09-17',
      ownerName: jane.displayName,
      ownerEmail: jane.email,
      lastChanged: '2026-09-23 16:40'
    }),
    report({
      id: 38,
      tripName: 'Customer visit, Denver',
      destination: 'Denver, CO',
      businessPurpose: 'Demonstrate the analyzer to a prospective customer.',
      tripPurpose: 'commercial',
      tripStart: '2026-09-08',
      tripEnd: '2026-09-10',
      status: 'Submitted',
      submissionCount: 1,
      submittedOn: '2026-09-12 08:15',
      ownerName: jane.displayName,
      ownerEmail: jane.email,
      lastChanged: '2026-09-12 08:15'
    }),
    report({
      id: 33,
      tripName: 'Phase I kickoff, Arlington',
      destination: 'Arlington, VA',
      businessPurpose: 'Phase I kickoff meeting with the program officer.',
      tripPurpose: 'nsfPhase1',
      tripStart: '2026-08-03',
      tripEnd: '2026-08-04',
      status: 'Processed',
      submissionCount: 1,
      submittedOn: '2026-08-06 11:02',
      processedOn: '2026-08-10 14:20',
      processedBy: 'Max Wamsley',
      ownerName: jane.displayName,
      ownerEmail: jane.email,
      lastChanged: '2026-08-10 14:20'
    }),
    report({
      id: 39,
      tripName: 'Supplier audit, Chicago',
      destination: 'Chicago, IL',
      businessPurpose: 'Audit the optics supplier before the next order.',
      tripPurpose: 'internalRnd',
      tripStart: '2026-09-01',
      tripEnd: '2026-09-03',
      status: 'Submitted',
      submissionCount: 1,
      submittedOn: '2026-09-05 17:48',
      ownerName: sam.displayName,
      ownerEmail: sam.email,
      lastChanged: '2026-09-05 17:48'
    }),
    report({
      id: 40,
      tripName: 'Trade show, Austin',
      destination: 'Austin, TX',
      businessPurpose: 'Staff the Clarus booth at the trade show.',
      tripPurpose: 'generalBusiness',
      tripStart: '2026-09-09',
      tripEnd: '2026-09-11',
      status: 'Returned',
      returnNote: 'Row 2: please attach the itemized hotel bill, not the card slip.',
      submissionCount: 1,
      submittedOn: '2026-09-13 09:30',
      ownerName: sam.displayName,
      ownerEmail: sam.email,
      lastChanged: '2026-09-14 10:05'
    })
  ];

  const lines: ExpenseLine[] = [
    // TR-0041, the draft used to show the Expenses step.
    row(41, 1, { date: '2026-08-20', vendor: 'Skyway Airlines', category: 'airfare', amountCents: 45230, paymentType: 'personal', receipts: [FILES.skyway()] }),
    row(41, 2, {
      date: '2026-08-10',
      vendor: 'Northeast Science Conference',
      category: 'registration',
      amountCents: 39500,
      paymentType: 'companyCard',
      receipts: [FILES.conference()]
    }),
    row(41, 3, {
      date: '2026-09-17',
      vendor: 'Harbor View Hotel',
      category: 'lodging',
      description: 'Room and tax, 3 nights',
      amountCents: 61224,
      paymentType: 'companyCard',
      receipts: [FILES.hotel()]
    }),
    row(41, 4, {
      date: '2026-09-15',
      vendor: 'Harbor Grill (hotel restaurant)',
      category: 'meals',
      amountCents: 4210,
      paymentType: 'companyCard',
      sameReceiptAsRow: 3
    }),
    row(41, 5, {
      date: '2026-09-14',
      vendor: 'City Cab Co.',
      category: 'transportation',
      description: 'Airport to hotel',
      amountCents: 4500,
      paymentType: 'personal',
      receipts: [FILES.cab()]
    }),
    row(41, 6, {
      date: '2026-09-15',
      vendor: 'Blue Door Bistro',
      category: 'businessMeal',
      amountCents: 14000,
      paymentType: 'personal',
      receipts: [FILES.bistro()]
    }),
    row(41, 7, { date: '2026-09-17', vendor: 'Metro Parking', category: 'transportation', amountCents: 7200, paymentType: '', receipts: [FILES.parking()] }),
    row(41, 8, {
      date: '2026-09-18',
      vendor: 'Harbor Water Taxi',
      category: 'transportation',
      amountCents: 1800,
      paymentType: 'personal',
      noReceiptReason: 'Paid cash; no receipt offered'
    }),

    // TR-0038 (submitted)
    row(38, 1, {
      date: '2026-09-08',
      vendor: 'Skyway Airlines',
      category: 'airfare',
      amountCents: 31840,
      paymentType: 'companyCard',
      receipts: [{ ...FILES.skyway(), id: 'f38-1', fingerprint: 'sample-38-1' }]
    }),
    row(38, 2, {
      date: '2026-09-09',
      vendor: 'Mile High Inn',
      category: 'lodging',
      amountCents: 28900,
      paymentType: 'companyCard',
      receipts: [{ ...FILES.hotel(), id: 'f38-2', fingerprint: 'sample-38-2' }]
    }),
    row(38, 3, {
      date: '2026-09-09',
      vendor: 'Blue Door Bistro',
      category: 'businessMeal',
      amountCents: 14000,
      paymentType: 'personal',
      description: 'Dinner with two customer engineers',
      receipts: [{ ...FILES.bistro(), id: 'f38-3', fingerprint: 'sample-38-3' }]
    }),

    // TR-0033 (processed)
    row(33, 1, {
      date: '2026-08-03',
      vendor: 'Capitol Rail',
      category: 'transportation',
      amountCents: 16800,
      paymentType: 'companyCard',
      receipts: [{ ...FILES.cab(), id: 'f33-1', fingerprint: 'sample-33-1' }]
    }),

    // TR-0039 (Sam, packaging failed). Row 2 matches Jane's TR-0038 row 3: a cross-employee duplicate.
    row(39, 1, {
      date: '2026-09-01',
      vendor: 'Lakeshore Hotel',
      category: 'lodging',
      amountCents: 41800,
      paymentType: 'companyCard',
      receipts: [{ ...FILES.hotel(), id: 'f39-1', fingerprint: 'sample-39-1' }]
    }),
    row(39, 2, {
      date: '2026-09-09',
      vendor: 'Blue Door Bistro',
      category: 'businessMeal',
      amountCents: 14000,
      paymentType: 'personal',
      description: 'Dinner with Jane Doe and two customer engineers',
      receipts: [{ ...FILES.bistro(), id: 'f39-2', fingerprint: 'sample-39-2' }]
    }),

    // TR-0040 (Sam, returned)
    row(40, 1, {
      date: '2026-09-09',
      vendor: 'Skyway Airlines',
      category: 'airfare',
      amountCents: 27600,
      paymentType: 'personal',
      receipts: [{ ...FILES.skyway(), id: 'f40-1', fingerprint: 'sample-40-1' }]
    }),
    row(40, 2, {
      date: '2026-09-11',
      vendor: 'Riverside Suites',
      category: 'lodging',
      amountCents: 50400,
      paymentType: 'companyCard',
      receipts: [{ ...FILES.parking(), id: 'f40-2', fingerprint: 'sample-40-2' }]
    })
  ];

  const base = {
    previousFolderName: '',
    folderLink: '',
    errorMessage: '',
    packagedAt: '',
    emailSubject: '',
    emailSummary: '',
    packageFileNames: [] as string[],
    certificationText: messages.certification
  };
  const submissions: Submission[] = [
    {
      ...base,
      id: 1,
      reportId: 38,
      reportNumber: 'TR-0038',
      submissionNumber: 1,
      packageStatus: 'Packaged',
      folderName: '2026-09-08_Jane-Doe_Customer-visit-Denver_TR-0038',
      folderLink: 'Accounting > Trips > Trips_To_Process > 2026-09-08_Jane-Doe_Customer-visit-Denver_TR-0038',
      submitterName: jane.displayName,
      submitterEmail: jane.email,
      submittedOn: '2026-09-12 08:15',
      tripName: 'Customer visit, Denver',
      destination: 'Denver, CO',
      tripStart: '2026-09-08',
      tripEnd: '2026-09-10',
      tripPurpose: 'Customer or commercial work',
      suggestedClass: '2.0 Commercial',
      totalReimburseCents: 14000,
      totalCompanyCents: 60740,
      totalTripCents: 74740,
      receiptCount: 3,
      rowsWithoutReceipt: 0,
      packagedAt: '2026-09-12 08:19'
    },
    {
      ...base,
      id: 2,
      reportId: 33,
      reportNumber: 'TR-0033',
      submissionNumber: 1,
      packageStatus: 'Packaged',
      folderName: '2026-08-03_Jane-Doe_Phase-I-kickoff-Arlington_TR-0033',
      folderLink: 'Accounting > Trips > Trips_To_Process > 2026-08-03_Jane-Doe_Phase-I-kickoff-Arlington_TR-0033',
      submitterName: jane.displayName,
      submitterEmail: jane.email,
      submittedOn: '2026-08-06 11:02',
      tripName: 'Phase I kickoff, Arlington',
      destination: 'Arlington, VA',
      tripStart: '2026-08-03',
      tripEnd: '2026-08-04',
      tripPurpose: 'NSF Phase I project work',
      suggestedClass: '1.01 NSF Phase 1 SBIR',
      totalReimburseCents: 0,
      totalCompanyCents: 16800,
      totalTripCents: 16800,
      receiptCount: 1,
      rowsWithoutReceipt: 0,
      packagedAt: '2026-08-06 11:06'
    },
    {
      ...base,
      id: 3,
      reportId: 39,
      reportNumber: 'TR-0039',
      submissionNumber: 1,
      packageStatus: 'Failed',
      folderName: '2026-09-01_Sam-Lee_Supplier-audit-Chicago_TR-0039',
      submitterName: sam.displayName,
      submitterEmail: sam.email,
      submittedOn: '2026-09-05 17:48',
      tripName: 'Supplier audit, Chicago',
      destination: 'Chicago, IL',
      tripStart: '2026-09-01',
      tripEnd: '2026-09-03',
      tripPurpose: 'Internal research and development',
      suggestedClass: '5.0 Internal R&D',
      totalReimburseCents: 14000,
      totalCompanyCents: 41800,
      totalTripCents: 55800,
      receiptCount: 2,
      rowsWithoutReceipt: 0,
      errorMessage: 'The SharePoint connection in the flow needs to be signed in again.'
    },
    {
      ...base,
      id: 4,
      reportId: 40,
      reportNumber: 'TR-0040',
      submissionNumber: 1,
      packageStatus: 'Packaged',
      folderName: '2026-09-09_Sam-Lee_Trade-show-Austin_TR-0040',
      folderLink: 'Accounting > Trips > Trips_To_Process > 2026-09-09_Sam-Lee_Trade-show-Austin_TR-0040',
      submitterName: sam.displayName,
      submitterEmail: sam.email,
      submittedOn: '2026-09-13 09:30',
      tripName: 'Trade show, Austin',
      destination: 'Austin, TX',
      tripStart: '2026-09-09',
      tripEnd: '2026-09-11',
      tripPurpose: 'General company business',
      suggestedClass: '8.0 Indirect Expenses',
      totalReimburseCents: 27600,
      totalCompanyCents: 50400,
      totalTripCents: 78000,
      receiptCount: 2,
      rowsWithoutReceipt: 0,
      packagedAt: '2026-09-13 09:34'
    }
  ];

  for (const r of reports) {
    const t = computeTotals(
      lines.filter((l) => l.reportId === r.id),
      activeTrips(r)
    );
    r.totalReimburseCents = t.reimburseCents;
    r.totalCompanyCents = t.companyCents;
    r.totalTripCents = t.tripCents;
  }

  const store: SampleStore = { reports, lines, submissions, csvBySubmission: {}, nextReportId: 42, nextSubmissionId: 5 };
  completeSampleOutputs(store);
  return store;
}

/**
 * Fills in what the app would have written at Submit for the sample
 * submissions (email text, CSV, package file names), using the real builders.
 */
function completeSampleOutputs(store: SampleStore): void {
  for (const s of store.submissions) {
    const report = store.reports.find((r) => r.id === s.reportId)!;
    const reportLines = store.lines.filter((l) => l.reportId === s.reportId).sort((a, b) => a.rowNumber - b.rowNumber);
    const warnings = validateReport(report, reportLines, [], s.submittedOn.slice(0, 10)).filter((i) => i.severity === 'warning');
    const totals = computeTotals(reportLines, activeTrips(report));
    const receipts = packageReceipts(reportLines);
    const csvName = csvFileName(report.reportNumber, s.submissionNumber);
    s.emailSubject = emailSubject(s.submitterName, s.tripName, s.reportNumber, s.submissionNumber);
    s.emailSummary = buildEmailSummary({
      report,
      lines: reportLines,
      totals,
      submitterName: s.submitterName,
      certification: { email: s.submitterEmail, text: s.certificationText, submittedOn: s.submittedOn },
      receiptCount: receipts.length,
      warnings,
      previousFolderName: s.previousFolderName
    });
    s.packageFileNames = [...receipts.map((r) => r.packageName), csvName];
    store.csvBySubmission[s.id] = buildExpensesCsv({
      report,
      lines: reportLines,
      submissionNumber: s.submissionNumber,
      submitterName: s.submitterName,
      submitterEmail: s.submitterEmail,
      submittedOn: s.submittedOn,
      warnings
    });
  }
}
