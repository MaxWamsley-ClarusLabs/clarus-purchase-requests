// The three SharePoint lists, as data (docs/DATA_MODEL.md). The set-up page
// creates them from these definitions and checks them after each update
// (D-063). A column added here is added to the site the next time an
// administrator opens the set-up page. Every address starts with "Travel" so
// the lists can share a site with other Clarus forms (D-075, D-077).

import { CATEGORIES, PAYMENT_TYPES, TEXT_MAX_LENGTH, TRIP_PURPOSES } from '../../domain/lists';
import { PackageStatus, ReportStatus } from '../../domain/types';
import { SetupListKey } from '../setup';

export type FieldType = 'Text' | 'Note' | 'Number' | 'Currency' | 'DateTime' | 'Choice' | 'User' | 'Boolean';

export interface FieldDef {
  /** Internal name; never changes once created. */
  name: string;
  displayName: string;
  type: FieldType;
  indexed?: boolean;
  choices?: readonly string[];
  defaultValue?: string;
}

export interface ListDef {
  key: ListKey;
  /** The last part of the list's address, /Lists/<urlName>. */
  urlName: string;
  title: string;
  description: string;
  /** Display name for the built-in Title column. */
  titleDisplayName: string;
  /**
   * Columns only this app's list has. A list at this address without the
   * app's description and without these columns belongs to something else,
   * and Set-up leaves it alone (D-077).
   */
  identityFields: readonly string[];
  fields: readonly FieldDef[];
  /** Built-in columns to index as well (for example Author). */
  indexBuiltIn?: readonly string[];
}

export type ListKey = SetupListKey;

/** Every list the app creates has a description starting with this (D-077). */
export const APP_LIST_MARKER = 'Travel Expenses app:';

export const REPORT_STATUSES: readonly ReportStatus[] = ['Draft', 'Submitted', 'Returned', 'Processed'];
export const PACKAGE_STATUSES: readonly PackageStatus[] = ['Uploading', 'Ready', 'Processing', 'Packaged', 'Failed'];

const text = (name: string, displayName: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, displayName, type: 'Text', ...extra });
const note = (name: string, displayName: string): FieldDef => ({ name, displayName, type: 'Note' });
const num = (name: string, displayName: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, displayName, type: 'Number', ...extra });
const money = (name: string, displayName: string): FieldDef => ({ name, displayName, type: 'Currency' });
const when = (name: string, displayName: string): FieldDef => ({ name, displayName, type: 'DateTime' });

export const LISTS: Record<ListKey, ListDef> = {
  reports: {
    key: 'reports',
    urlName: 'TravelReports',
    title: 'Travel Reports',
    description: 'Travel Expenses app: one item per trip. Created by the app; see docs/DATA_MODEL.md.',
    titleDisplayName: 'Trip name',
    identityFields: ['ReportNumber', 'ReportStatus'],
    indexBuiltIn: ['Author'],
    fields: [
      text('ReportNumber', 'Report number'),
      text('Destination', 'Destination'),
      note('BusinessPurpose', 'Business purpose'),
      { name: 'TripPurpose', displayName: 'What was this trip for?', type: 'Choice', choices: TRIP_PURPOSES.map((t) => t.label) },
      text('TripStart', 'Trip start'),
      text('TripEnd', 'Trip end'),
      { name: 'HasMileage', displayName: 'I drove my own car', type: 'Boolean', defaultValue: '0' },
      note('MileageTrips', 'Mileage drives'),
      { name: 'ReportStatus', displayName: 'Status', type: 'Choice', choices: REPORT_STATUSES, defaultValue: 'Draft', indexed: true },
      note('ReturnNote', 'Return note'),
      money('TotalReimburse', 'To reimburse'),
      money('TotalCompany', 'Company-paid'),
      money('TotalTrip', 'Trip total'),
      num('SubmissionCount', 'Submissions', { defaultValue: '0' }),
      when('SubmittedOn', 'Submitted'),
      when('ProcessedOn', 'Processed'),
      { name: 'ProcessedBy', displayName: 'Processed by', type: 'User' }
    ]
  },
  lines: {
    key: 'lines',
    urlName: 'TravelExpenseLines',
    title: 'Travel Expense Lines',
    description: 'Travel Expenses app: one item per expense row; receipts are attachments. Created by the app.',
    titleDisplayName: 'Row label',
    identityFields: ['ReportId', 'RowNumber'],
    fields: [
      num('ReportId', 'Report', { indexed: true }),
      num('RowNumber', 'Row'),
      text('ExpenseDate', 'Date'),
      text('Vendor', 'Vendor'),
      { name: 'Category', displayName: 'Category', type: 'Choice', choices: CATEGORIES.map((c) => c.label) },
      text('Description', 'Description'),
      money('Amount', 'Amount'),
      { name: 'PaymentType', displayName: 'Payment type', type: 'Choice', choices: PAYMENT_TYPES.map((p) => p.label) },
      text('NoReceiptReason', 'No-receipt reason'),
      num('SameReceiptAsRow', 'Same receipt as row'),
      note('FileFingerprints', 'File fingerprints'),
      // Values the app filled in that the employee has not confirmed (D-078).
      text('SuggestedFields', 'Suggested, not confirmed')
    ]
  },
  submissions: {
    key: 'submissions',
    urlName: 'TravelSubmissions',
    title: 'Travel Submissions',
    description: 'Travel Expenses app: one item per submission, completed by the flow. Created by the app.',
    titleDisplayName: 'Label',
    identityFields: ['ReportId', 'SubmissionNumber'],
    fields: [
      num('ReportId', 'Report', { indexed: true }),
      num('SubmissionNumber', 'Submission'),
      { name: 'PackageStatus', displayName: 'Package status', type: 'Choice', choices: PACKAGE_STATUSES, defaultValue: 'Uploading', indexed: true },
      text('FolderName', 'Folder name'),
      text('PreviousFolderName', 'Replaces folder'),
      text('SubmitterName', 'Submitted by'),
      text('SubmitterEmail', 'Submitted by (account)'),
      note('CertificationText', 'Certification'),
      text('TripName', 'Trip name'),
      text('Destination', 'Destination'),
      text('TripStart', 'Trip start'),
      text('TripEnd', 'Trip end'),
      text('TripPurpose', 'Trip purpose'),
      text('SuggestedClass', 'Suggested class'),
      money('TotalReimburse', 'To reimburse'),
      money('TotalCompany', 'Company-paid'),
      money('TotalTrip', 'Trip total'),
      num('ReceiptCount', 'Receipts'),
      num('RowsWithoutReceipt', 'Rows without a receipt'),
      text('EmailSubject', 'Email subject'),
      note('EmailSummary', 'Email summary'),
      note('FolderLink', 'Folder link'),
      when('PackagedAt', 'Packaged'),
      note('ErrorMessage', 'Error')
    ]
  }
};

export { TEXT_MAX_LENGTH };

function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function content(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The SharePoint field definition (CAML) used to create a column. */
export function fieldXml(field: FieldDef): string {
  const common = `DisplayName="${attr(field.displayName)}" Name="${attr(field.name)}" StaticName="${attr(field.name)}" Required="FALSE"${
    field.indexed ? ' Indexed="TRUE"' : ''
  }`;
  const defaultValue = field.defaultValue !== undefined ? `<Default>${content(field.defaultValue)}</Default>` : '';
  switch (field.type) {
    case 'Text':
      return `<Field Type="Text" ${common} MaxLength="${TEXT_MAX_LENGTH}" />`;
    case 'Note':
      return `<Field Type="Note" ${common} NumLines="6" RichText="FALSE" />`;
    case 'Number':
      return `<Field Type="Number" ${common} Decimals="0">${defaultValue}</Field>`;
    case 'Currency':
      return `<Field Type="Currency" ${common} Decimals="2" LCID="1033" />`;
    case 'DateTime':
      return `<Field Type="DateTime" ${common} Format="DateTime" />`;
    case 'Boolean':
      return `<Field Type="Boolean" ${common}>${defaultValue}</Field>`;
    case 'User':
      return `<Field Type="User" ${common} List="UserInfo" UserSelectionMode="PeopleOnly" ShowField="ImnName" />`;
    case 'Choice': {
      const choices = (field.choices ?? []).map((c) => `<CHOICE>${content(c)}</CHOICE>`).join('');
      return `<Field Type="Choice" ${common} Format="Dropdown" FillInChoice="FALSE">${defaultValue}<CHOICES>${choices}</CHOICES></Field>`;
    }
  }
}
