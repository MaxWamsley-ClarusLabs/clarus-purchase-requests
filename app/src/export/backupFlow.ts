// The nightly ledger backup flow and its import package (P-059). A second, separate flow: every night it reads the
// Purchase Requests and Purchase Request Lines lists and writes a new dated pair of files, a CSV and a Markdown file,
// into Accounting > Purchases > Ledger_Backups. The files hold every purchase line of every request that has been
// bought, with the account, class and Posted status the bookkeepers have set, so the bookkeeping survives if a list is
// ever damaged. Each night is a new pair: nothing is overwritten, moved or deleted (Max, 2026-11-15).
//
// Like the Purchase Requests flow it is made by the Set-up page with this site's addresses written in, to the same
// rules: the destination is fixed here (a Live package can only write to the Accounting folders, a Test package only to
// the test site's own library), and no list text ever chooses where a file goes. List text only ever appears inside the
// files, as text.

import {
  BACKUP_FOLDER_NAME,
  EMAIL_STYLE,
  FlowConfig,
  LIST_ID,
  OK,
  PackageParts,
  assemblePackage,
  attr,
  checkAdminEmail,
  checkDestination,
  checkMode,
  email,
  http,
  lit,
  notMade,
  pageUrl,
  sitePath,
  spHost
} from './flowPackage';

export { BACKUP_FOLDER_NAME };

/** What the backup flow needs from the site. A shorter list than the Purchase Requests flow's: no approvers, no submissions. */
export interface BackupFlowConfig {
  mode: FlowConfig['mode'];
  /** The Forms and Apps site holding the lists. */
  siteUrl: string;
  requestsListId: string;
  linesListId: string;
  /** Where the backup folder is. The same fixed destinations as the Purchase Requests flow (P-008). */
  destinationSiteUrl: string;
  libraryUrlName: string;
  folders: string[];
  /** Who is told if a backup fails. */
  adminEmail: string;
  /** The page the app runs on, for the link in the failure email. Only its origin and path are used. */
  appPageUrl: string;
}

export const BACKUP_FLOW_NAMES: Record<BackupFlowConfig['mode'], string> = {
  test: 'Purchase Requests ledger backup (test site)',
  live: 'Purchase Requests ledger backup'
};

/** The time the backup runs: 02:30 Central time, when nobody is working in the app. */
export const BACKUP_TIME = { hour: '2', minute: 30, timeZone: 'Central Standard Time' } as const;

/** How many items each list read asks for. SharePoint's list view limit is 5,000 items (Unverified, flow/FLOW.md). */
const MAX_ITEMS = 5000;

/** Checks everything the backup flow takes from the config; throws an Error with a plain message if it cannot be used safely. */
export function checkBackupFlowConfig(config: BackupFlowConfig): BackupFlowConfig {
  checkMode(config.mode);
  for (const [id, what] of [
    [config.requestsListId, 'Purchase Requests'],
    [config.linesListId, 'Purchase Request Lines']
  ] as const) {
    if (typeof id !== 'string' || !LIST_ID.test(id)) throw notMade(`the ID of the ${what} list is not in the form SharePoint gives it.`);
  }
  checkDestination(config);
  checkAdminEmail(config.adminEmail);
  return { ...config, appPageUrl: pageUrl(config.appPageUrl) };
}

/** An expression for a stored text: empty when there is none. */
const textOf = (field: string): string => `coalesce(item()?['${field}'], '')`;
/** A choice column's chosen text. */
const choiceOf = (field: string): string => `coalesce(item()?['${field}']?['Value'], '')`;
/** "Y" or "N" for the Posted column, which reads as N unless it is exactly yes. */
const postedOf = "if(equals(item()?['LedgerPosted'], true), 'Y', 'N')";

/** One column of the backup, as its header and the expression for a line. Every value is text, apart from the two numbers. */
interface BackupColumn {
  header: string;
  value: string;
  /** Text typed by a person, which a spreadsheet could read as a formula and a Markdown table could break. */
  text: boolean;
}

const COLUMNS: readonly BackupColumn[] = [
  { header: 'Line', value: textOf('Title'), text: true },
  { header: 'Request ID', value: "string(coalesce(item()?['RequestId'], ''))", text: false },
  { header: 'Row', value: "string(coalesce(item()?['RowNumber'], ''))", text: false },
  { header: 'Date', value: textOf('PurchaseDate'), text: true },
  { header: 'Vendor', value: textOf('Vendor'), text: true },
  { header: 'What was bought and why', value: textOf('Description'), text: true },
  { header: 'Category', value: choiceOf('Category'), text: true },
  { header: 'Other category', value: textOf('CategoryOther'), text: true },
  { header: 'Quantity', value: "string(coalesce(item()?['Quantity'], 1))", text: false },
  { header: 'Amount', value: "string(coalesce(item()?['Amount'], ''))", text: false },
  { header: 'Who paid', value: choiceOf('PaidBy'), text: true },
  { header: 'QuickBooks account', value: textOf('LedgerAccount'), text: true },
  { header: 'Class', value: textOf('LedgerClass'), text: true },
  { header: 'Posted', value: postedOf, text: false },
  { header: 'Posted by', value: textOf('LedgerPostedBy'), text: true },
  { header: 'Posted on', value: textOf('LedgerPostedOn'), text: true },
  { header: 'No-receipt reason', value: textOf('NoReceiptReason'), text: true }
];

/** The same protection as the app's CSV (csv.ts): text that starts with = + - or @ gets a leading apostrophe, so opening the file never runs anything. */
function csvSafe(value: string): string {
  return `if(or(startsWith(${value}, '='), startsWith(${value}, '+'), startsWith(${value}, '-'), startsWith(${value}, '@')), concat('''', ${value}), ${value})`;
}

/** Text for one cell of a Markdown table: the pipe is escaped, and a line break would end the row, so it becomes a space. */
function mdSafe(value: string): string {
  return `replace(replace(replace(${value}, '|', ${lit('\\|')}), decodeUriComponent('%0D'), ' '), decodeUriComponent('%0A'), ' ')`;
}

const NEWLINE = "decodeUriComponent('%0A')";

/** The backup flow's definition. Throws if the config does not pass checkBackupFlowConfig. */
export function buildBackupFlowDefinition(config: BackupFlowConfig): Record<string, unknown> {
  return definitionOf(checkBackupFlowConfig(config));
}

function definitionOf(config: BackupFlowConfig): Record<string, unknown> {
  const destPath = `${sitePath(config.destinationSiteUrl)}/${config.libraryUrlName}`;
  const parent = config.folders[config.folders.length - 2];
  const backupFolder = `${parent}/${BACKUP_FOLDER_NAME}`;
  const backupServerPath = `${destPath}/${backupFolder}`;
  const existsUri = `_api/web/GetFolderByServerRelativeUrl('${backupServerPath.replace(/'/g, "''")}')/Exists`;
  const createUri = `_api/web/folders/addUsingPath(decodedurl='${backupServerPath.replace(/'/g, "''")}')`;
  const appUrl = attr(config.appPageUrl);
  const runLink =
    "concat('https://make.powerautomate.com/environments/', workflow()?['tags']?['environmentName'], '/flows/', workflow()?['name'], '/runs/', workflow()?['run']?['name'])";
  const read = (list: string, extra: Record<string, unknown> = {}) => ({
    type: 'OpenApiConnection',
    inputs: {
      host: spHost('GetItems'),
      parameters: { dataset: config.siteUrl, table: list, ...extra, $top: MAX_ITEMS },
      authentication: "@parameters('$authentication')"
    },
    // Reads every page up to the limit, not only the first 100 items.
    runtimeConfiguration: { paginationPolicy: { minimumItemCount: MAX_ITEMS } }
  });
  const headerRow = `| ${COLUMNS.map((c) => c.header).join(' | ')} |`;
  const dividerRow = `| ${COLUMNS.map(() => '---').join(' | ')} |`;
  const mdRow = `concat('| ', ${COLUMNS.map((c) => mdSafe(c.value)).join(", ' | ', ")}, ' |')`;
  const stamp = "outputs('Stamp')";
  const folderPath = `/${config.libraryUrlName}/${backupFolder}/`;

  const backup: Record<string, unknown> = {
    // The requests that have been bought are the ones whose lines belong in the ledger (Submitted, or Processed after it).
    Get_bought_requests: {
      runAfter: {},
      ...read(config.requestsListId, { $filter: "RequestStatus eq 'Submitted' or RequestStatus eq 'Processed'" })
    },
    Bought_request_ids: {
      runAfter: { Get_bought_requests: OK },
      type: 'Select',
      inputs: { from: "@body('Get_bought_requests')?['value']", select: "@item()?['ID']" }
    },
    Get_all_lines: { runAfter: { Bought_request_ids: OK }, ...read(config.linesListId) },
    Ledger_lines: {
      runAfter: { Get_all_lines: OK },
      type: 'Query',
      inputs: { from: "@body('Get_all_lines')?['value']", where: "@contains(body('Bought_request_ids'), item()?['RequestId'])" }
    },
    // The time the backup was taken, in Central time, down to the minute: part of each file's name, so no night's files are ever replaced.
    Stamp: {
      runAfter: { Ledger_lines: OK },
      type: 'Compose',
      inputs: `@formatDateTime(convertTimeZone(utcNow(), 'UTC', ${lit(BACKUP_TIME.timeZone)}), 'yyyy-MM-dd_HHmm')`
    },
    Lines_csv: {
      runAfter: { Stamp: OK },
      type: 'Table',
      inputs: {
        from: "@body('Ledger_lines')",
        format: 'CSV',
        columns: COLUMNS.map((c) => ({ header: c.header, value: `@${c.text ? csvSafe(c.value) : c.value}` }))
      }
    },
    Markdown_rows: {
      runAfter: { Lines_csv: OK },
      type: 'Select',
      inputs: { from: "@body('Ledger_lines')", select: `@${mdRow}` }
    },
    // The folder is made on the first night only. Nothing already in it is touched.
    Check_backup_folder: http(config, 'GET', existsUri, { Markdown_rows: OK }),
    If_the_backup_folder_is_missing: {
      runAfter: { Check_backup_folder: OK },
      type: 'If',
      expression: { and: [{ equals: ["@body('Check_backup_folder')?['d']?['Exists']", false] }] },
      actions: { Create_backup_folder: http(config, 'POST', createUri, {}) },
      else: { actions: {} }
    },
    Create_csv_file: {
      runAfter: { If_the_backup_folder_is_missing: OK },
      type: 'OpenApiConnection',
      inputs: {
        host: spHost('CreateFile'),
        parameters: {
          dataset: config.destinationSiteUrl,
          folderPath,
          name: `@{concat('Ledger_', ${stamp}, '.csv')}`,
          // A byte-order mark first, so Excel reads the file as UTF-8.
          body: "@concat(decodeUriComponent('%EF%BB%BF'), body('Lines_csv'))"
        },
        authentication: "@parameters('$authentication')"
      },
      runtimeConfiguration: { contentTransfer: { transferMode: 'Chunked' } }
    },
    Create_markdown_file: {
      runAfter: { Create_csv_file: OK },
      type: 'OpenApiConnection',
      inputs: {
        host: spHost('CreateFile'),
        parameters: {
          dataset: config.destinationSiteUrl,
          folderPath,
          name: `@{concat('Ledger_', ${stamp}, '.md')}`,
          body:
            `@concat('# Purchases ledger backup', ${NEWLINE}, ${NEWLINE}, 'Taken ', ${stamp}, ' (Central time). ` +
            `Every purchase line of every request that has been bought, with the QuickBooks account, class and Posted status set in the Ledger. ` +
            `A copy for safekeeping: the Ledger in Purchase Requests is the live record.', ${NEWLINE}, ${NEWLINE}, ${lit(headerRow)}, ${NEWLINE}, ${lit(dividerRow)}, ${NEWLINE}, ` +
            `join(body('Markdown_rows'), ${NEWLINE}), ${NEWLINE})`
        },
        authentication: "@parameters('$authentication')"
      },
      runtimeConfiguration: { contentTransfer: { transferMode: 'Chunked' } }
    }
  };

  const onFailure: Record<string, unknown> = {
    Send_backup_failure_email: email(
      {},
      config.adminEmail,
      'Purchase Requests ledger backup failed',
      `<div style="${EMAIL_STYLE}"><p>Last night's ledger backup did not finish, so no new backup files were made. Nothing in the Ledger or the lists was changed.</p>` +
        `<p><a href="@{${runLink}}">Open the flow run</a> &middot; <a href="${appUrl}#/ledger">Open the Ledger</a></p></div>`
    )
  };

  return {
    $schema: 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
    contentVersion: '1.0.0.0',
    parameters: {
      $connections: { defaultValue: {}, type: 'Object' },
      $authentication: { defaultValue: {}, type: 'SecureObject' }
    },
    triggers: {
      Every_night: {
        type: 'Recurrence',
        recurrence: { frequency: 'Day', interval: 1, timeZone: BACKUP_TIME.timeZone, schedule: { hours: [BACKUP_TIME.hour], minutes: [BACKUP_TIME.minute] } }
      }
    },
    actions: {
      Backup: { runAfter: {}, type: 'Scope', actions: backup },
      On_backup_failure: { runAfter: { Backup: ['Failed', 'TimedOut'] }, type: 'Scope', actions: onFailure }
    }
  };
}

export interface BackupFlowPackage {
  fileName: string;
  zip: Uint8Array;
  files: Record<string, string>;
}

/** The legacy import package for the backup flow. Throws if the config does not pass checkBackupFlowConfig. */
export function buildBackupFlowPackage(config: BackupFlowConfig, newId: () => string = () => crypto.randomUUID(), now: Date = new Date()): BackupFlowPackage {
  const checked = checkBackupFlowConfig(config);
  const parts: PackageParts = {
    displayName: BACKUP_FLOW_NAMES[config.mode],
    description:
      'Every night, saves a new dated CSV and Markdown copy of the purchases ledger (every purchase line of every request that has been bought, with its QuickBooks account, class and Posted status) in Accounting > Purchases > Ledger_Backups. Never overwrites anything. Generated by the Purchase Requests Set-up page.',
    definition: definitionOf(checked),
    fileName: `PurchaseRequests_Ledger_Backup_Flow_${config.mode === 'test' ? 'Test' : 'Live'}.zip`
  };
  return assemblePackage(parts, newId, now);
}
