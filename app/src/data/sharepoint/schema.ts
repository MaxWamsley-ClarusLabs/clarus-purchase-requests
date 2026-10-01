// The three SharePoint lists, as data (docs/DATA_MODEL.md). The set-up page
// creates them from these definitions and checks them after each update
// (travel D-063). A column added here is added to the site the next time an
// administrator opens the set-up page. Every address starts with "Purchase" so
// the lists can share a site with other Clarus forms (P-007, travel D-077).

import { CATEGORIES, PAID_BY_OPTIONS } from '../../domain/purchaseRules';
import { REQUEST_STATUSES } from '../../domain/statuses';
import { PackageStatus, ReturnStage, SubmissionType, TEXT_MAX_LENGTH } from '../../domain/types';
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
   * and Set-up leaves it alone (travel D-077).
   */
  identityFields: readonly string[];
  fields: readonly FieldDef[];
  /** Built-in columns to index as well (for example Author). */
  indexBuiltIn?: readonly string[];
}

export type ListKey = SetupListKey;

/** Every list the app creates has a description starting with this (travel D-077). */
export const APP_LIST_MARKER = 'Purchase Requests app:';

export const PACKAGE_STATUSES: readonly PackageStatus[] = ['Uploading', 'Ready', 'Processing', 'Packaged', 'Failed'];

/** The Type column's choices, by the value the app uses (P-018). */
export const SUBMISSION_TYPE_LABELS: Record<SubmissionType, string> = { approval: 'Approval request', package: 'Processing package' };

/** The Returned at column's choices, by the value the app uses. The app's '' is an empty column. */
export const RETURN_STAGE_LABELS: Record<Exclude<ReturnStage, ''>, string> = { approval: 'Approval', processing: 'Processing' };

const text = (name: string, displayName: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, displayName, type: 'Text', ...extra });
const note = (name: string, displayName: string): FieldDef => ({ name, displayName, type: 'Note' });
const num = (name: string, displayName: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, displayName, type: 'Number', ...extra });
const money = (name: string, displayName: string): FieldDef => ({ name, displayName, type: 'Currency' });
const when = (name: string, displayName: string): FieldDef => ({ name, displayName, type: 'DateTime' });
const person = (name: string, displayName: string): FieldDef => ({ name, displayName, type: 'User' });
const yesNo = (name: string, displayName: string): FieldDef => ({ name, displayName, type: 'Boolean', defaultValue: '0' });

export const LISTS: Record<ListKey, ListDef> = {
  requests: {
    key: 'requests',
    urlName: 'PurchaseRequests',
    title: 'Purchase Requests',
    description: 'Purchase Requests app: one item per purchase request. Created by the app; see docs/DATA_MODEL.md.',
    titleDisplayName: 'Business purpose',
    identityFields: ['RequestNumber', 'RequestStatus'],
    indexBuiltIn: ['Author'],
    fields: [
      text('RequestNumber', 'Request number'),
      text('Department', 'Department'),
      text('ProjectCode', 'Project or grant code'),
      { name: 'RequestStatus', displayName: 'Status', type: 'Choice', choices: REQUEST_STATUSES, defaultValue: 'Draft', indexed: true },
      note('ReturnNote', 'Return note'),
      { name: 'ReturnStage', displayName: 'Returned at', type: 'Choice', choices: Object.values(RETURN_STAGE_LABELS) },
      money('TotalReimburse', 'To reimburse'),
      money('TotalCompany', 'Paid by Clarus'),
      money('TotalRequest', 'Request total'),
      num('SubmissionCount', 'Submissions', { defaultValue: '0' }),
      num('ApprovalRounds', 'Approval requests', { defaultValue: '0' }),
      when('SentForApprovalOn', 'Sent for approval'),
      yesNo('BoughtBeforeApproval', 'Bought before approval'),
      note('ApprovalRecord', 'Approval record'),
      note('ApprovalNote', 'Approval note'),
      when('ApprovedOn', 'Approved'),
      person('ApprovedBy', 'Approved by'),
      when('SubmittedOn', 'Submitted'),
      when('ProcessedOn', 'Processed'),
      person('ProcessedBy', 'Processed by')
    ]
  },
  lines: {
    key: 'lines',
    urlName: 'PurchaseRequestLines',
    title: 'Purchase Request Lines',
    description: 'Purchase Requests app: one item per purchase; receipts and quotes are attachments. Created by the app.',
    titleDisplayName: 'Row label',
    identityFields: ['RequestId', 'RowNumber'],
    fields: [
      num('RequestId', 'Request', { indexed: true }),
      num('RowNumber', 'Row'),
      text('PurchaseDate', 'Date'),
      text('Vendor', 'Vendor'),
      text('Description', 'What was bought and why'),
      { name: 'Category', displayName: 'Category', type: 'Choice', choices: CATEGORIES.map((c) => c.label) },
      text('CategoryOther', 'Other category'),
      text('CategoryConfirmedBy', 'Category confirmed by'),
      money('Amount', 'Amount'),
      { name: 'PaidBy', displayName: 'Who paid', type: 'Choice', choices: PAID_BY_OPTIONS.map((p) => p.label) },
      text('NoQuoteReason', 'No-quote reason'),
      text('NoReceiptReason', 'No-receipt reason'),
      num('SameReceiptAsRow', 'Same receipt as row'),
      note('FileFingerprints', 'File fingerprints'),
      // Values the app filled in that the employee has not confirmed (travel D-078).
      text('SuggestedFields', 'Suggested, not confirmed')
    ]
  },
  submissions: {
    key: 'submissions',
    urlName: 'PurchaseSubmissions',
    title: 'Purchase Submissions',
    description: 'Purchase Requests app: one item per approval request or submission, completed by the flow. Created by the app.',
    titleDisplayName: 'Label',
    identityFields: ['RequestId', 'SubmissionNumber'],
    fields: [
      num('RequestId', 'Request', { indexed: true }),
      {
        name: 'SubmissionType',
        displayName: 'Type',
        type: 'Choice',
        choices: Object.values(SUBMISSION_TYPE_LABELS),
        defaultValue: SUBMISSION_TYPE_LABELS.package
      },
      num('SubmissionNumber', 'Submission'),
      { name: 'PackageStatus', displayName: 'Package status', type: 'Choice', choices: PACKAGE_STATUSES, defaultValue: 'Uploading', indexed: true },
      text('FolderName', 'Folder name'),
      text('PreviousFolderName', 'Replaces folder'),
      text('SubmitterName', 'Submitted by'),
      text('SubmitterEmail', 'Submitted by (account)'),
      note('CertificationText', 'Certification'),
      text('BusinessPurpose', 'Business purpose'),
      text('Department', 'Department'),
      text('ProjectCode', 'Project or grant code'),
      text('PurchaseDates', 'Purchase dates'),
      money('TotalReimburse', 'To reimburse'),
      money('TotalCompany', 'Paid by Clarus'),
      money('TotalRequest', 'Request total'),
      num('ReceiptCount', 'Receipts'),
      num('QuoteCount', 'Quotes'),
      num('RowsWithoutReceipt', 'Rows without a receipt'),
      yesNo('BoughtBeforeApproval', 'Bought before approval'),
      // The approver's name and time as frozen text, not a person or date column (docs/DATA_MODEL.md).
      text('ApprovedBy', 'Approved by'),
      text('ApprovedOn', 'Approved'),
      text('EmailSubject', 'Email subject'),
      note('EmailSummary', 'Email summary'),
      note('FolderLink', 'Folder link'),
      when('PackagedAt', 'Packaged'),
      note('ErrorMessage', 'Error')
    ]
  }
};

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
