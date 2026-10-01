// The Purchase Requests flow (strategy sections 7 and 8) and its import package
// (travel D-047). The Set-up page fills in this site's addresses and IDs and
// downloads the package; Max imports it in Power Automate (Import Package
// (Legacy)).
//
// One flow with two branches (P-018). After the trigger and the claim, the
// submission's type decides: an approval request only emails the approvers; a
// processing package is handled exactly as in the travel flow (folders, file
// copies, status, email).
//
// Action formats follow working exports (pnp/powerautomate-samples) and
// Microsoft's connector reference. The packaging branch is the travel flow,
// which ran on a real site; the unverified points (the branch and the approval
// email) are listed in flow/FLOW.md and checked at the test-site checkpoint.
//
// Safety (strategy section 7): the destination folder and the approvers'
// addresses are fixed here, never taken from list data; the folder name written
// by the app is cleaned again; nothing is overwritten, moved or deleted; the
// email text stored in the list is escaped before it is sent (travel D-067).
// The generator enforces this itself (checkFlowConfig): every address, ID and
// destination it writes into the flow is checked first, and a package that
// does not pass is not made.

import { buildZip } from './zip';

export type FlowMode = 'test' | 'live';

/** Where the approval email addresses came from: the site Owners, or the administrator's own address because no Owner address could be read. */
export type ApproverSource = 'owners' | 'administrator';

export interface FlowConfig {
  mode: FlowMode;
  /** The Forms and Apps site holding the Purchase Submissions list. */
  siteUrl: string;
  submissionsListId: string;
  /** Where request folders are created. */
  destinationSiteUrl: string;
  /** The destination library's address on its site, for example "Shared Documents". */
  libraryUrlName: string;
  /** Folders inside the library, parent first; the last is the landing folder. */
  folders: string[];
  /** Who receives the submission and failure emails (v1: the administrator who makes the package, travel D-029). */
  adminEmail: string;
  /** Who receives the approval email: the site Owners' addresses when the package is made, fixed in the package (P-018). */
  approverEmails: string[];
  /** Where approverEmails came from, so the Set-up page can say so. Not written into the flow. */
  approverSource: ApproverSource;
  /** The page the app runs on, for the "open the request" links. Only its origin and path are used. */
  appPageUrl: string;
}

/** The fixed live destination (strategy section 7). */
export const LIVE_DESTINATION = {
  siteUrl: 'https://claruslabsusa.sharepoint.com/sites/ExecutiveTeam',
  libraryUrlName: 'Shared Documents',
  /** Must already exist. The flow does not check it: the Set-up page does, read only, when it makes a live package. */
  existingParent: '01_Company Documents/Accounting',
  folders: ['01_Company Documents/Accounting/Purchases', '01_Company Documents/Accounting/Purchases/Purchases_To_Process']
} as const;

/** The test destination: the test site's own library, outside Accounting (strategy section 10). */
export const TEST_FOLDERS = ['Purchases_Test', 'Purchases_Test/Purchases_To_Process'];

/** The test destination's library: the test site's own Documents library, as the Set-up page reads it. */
export const TEST_LIBRARY_URL_NAME = 'Shared Documents';

/** The most addresses the approval email can go to. More are refused, so the To line stays a sane length. */
export const MAX_APPROVERS = 20;

const MAX_EMAIL_LENGTH = 254;
const SAFE_EMAIL = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const LIST_ID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
/** Text a web address written into the flow must not contain: braces (so no "@{" either), quotes, backticks, backslashes, angle brackets or spaces. */
const UNSAFE_URL_TEXT = /[{}"'`\\<>\s]/;

/**
 * Whether an address can go into the flow as it is: one plain ASCII address of
 * at most 254 characters, with nothing the flow could read as an expression or
 * as a second address (no spaces, commas, semicolons, braces, angle brackets,
 * double quotes, backticks or backslashes, and no leading @).
 */
export function isSafeEmailAddress(value: string): boolean {
  return typeof value === 'string' && value.length <= MAX_EMAIL_LENGTH && SAFE_EMAIL.test(value);
}

function hasControlCharacter(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

function notMade(reason: string): Error {
  return new Error(`The flow package was not made: ${reason}`);
}

/** An https address with no user name, password or unsafe text. */
function httpsUrl(value: string, what: string): URL {
  const refused = notMade(`${what} "${value}" is not a plain https address the flow can use.`);
  if (typeof value !== 'string' || UNSAFE_URL_TEXT.test(value) || hasControlCharacter(value)) throw refused;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw refused;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') throw refused;
  return url;
}

/** A site address: https, and no query string or fragment, so it is used exactly as SharePoint gave it. */
function checkSiteUrl(value: string, what: string): void {
  httpsUrl(value, what);
  if (/[?#]/.test(value)) throw notMade(`${what} "${value}" is not a plain https address the flow can use.`);
}

/**
 * The page address for the email links, reduced to its origin and path. A query
 * string or fragment is dropped, so a Set-up page opened with a crafted address
 * (browsers do not encode braces in a query string) cannot put an expression
 * into the emails.
 */
function pageUrl(value: string): string {
  const what = 'the address of the Purchase Requests page';
  if (typeof value !== 'string') throw notMade(`${what} is missing.`);
  const url = httpsUrl(value.split(/[?#]/)[0], what);
  const page = url.origin + url.pathname;
  if (UNSAFE_URL_TEXT.test(page) || hasControlCharacter(page)) throw notMade(`${what} "${page}" is not a plain https address the flow can use.`);
  return page;
}

const sameFolders = (folders: readonly string[], expected: readonly string[]): boolean =>
  Array.isArray(folders) && folders.length === expected.length && folders.every((folder, i) => folder === expected[i]);

/** A config that passed checkFlowConfig. */
export interface CheckedFlowConfig extends FlowConfig {
  /** Who the approval email goes to: the approvers, or the administrator if there are none. */
  approvalRecipients: string[];
}

/**
 * Checks everything the flow takes from the config and throws an Error with a
 * plain message if anything could not be used safely (strategy section 7,
 * P-008, P-018). Returns the config with the page address reduced to its origin
 * and path, and the approval email's recipients.
 */
export function checkFlowConfig(config: FlowConfig): CheckedFlowConfig {
  if (config.mode !== 'test' && config.mode !== 'live') throw notMade('it must be a Test or a Live package.');
  if (typeof config.submissionsListId !== 'string' || !LIST_ID.test(config.submissionsListId))
    throw notMade('the ID of the Purchase Submissions list is not in the form SharePoint gives it.');
  checkSiteUrl(config.siteUrl, 'the site address');
  checkSiteUrl(config.destinationSiteUrl, 'the destination site address');
  // A live package can only ever write to the fixed Accounting folders; a test package only to this site's own library.
  if (config.mode === 'live') {
    if (
      config.destinationSiteUrl !== LIVE_DESTINATION.siteUrl ||
      config.libraryUrlName !== LIVE_DESTINATION.libraryUrlName ||
      !sameFolders(config.folders, LIVE_DESTINATION.folders)
    )
      throw notMade('a Live package can only send folders to Accounting > Purchases > Purchases_To_Process on the ExecutiveTeam site.');
  } else if (config.destinationSiteUrl !== config.siteUrl || config.libraryUrlName !== TEST_LIBRARY_URL_NAME || !sameFolders(config.folders, TEST_FOLDERS)) {
    throw notMade("a Test package can only send folders to this site's own Documents library, in Purchases_Test > Purchases_To_Process.");
  }
  if (!isSafeEmailAddress(config.adminEmail))
    throw notMade(`the administrator's email address "${config.adminEmail}" cannot be used by the flow. It must be one plain email address.`);
  if (!Array.isArray(config.approverEmails)) throw notMade('the list of approver addresses is missing.');
  if (config.approverEmails.length > MAX_APPROVERS)
    throw notMade(`the approval email can go to at most ${MAX_APPROVERS} addresses, and there are ${config.approverEmails.length}.`);
  for (const address of config.approverEmails) {
    if (!isSafeEmailAddress(address)) throw notMade(`the approver address "${address}" cannot be used by the flow. Each must be one plain email address.`);
  }
  // No approvers: the administrator (P-018). The flow relies on at least one recipient; the administrator's
  // address has passed above, so this always holds, and the check keeps the promise visible.
  const approvalRecipients = config.approverEmails.length > 0 ? [...config.approverEmails] : [config.adminEmail];
  if (approvalRecipients.length === 0) throw notMade('the approval email has no one to go to.');
  return { ...config, appPageUrl: pageUrl(config.appPageUrl), approvalRecipients };
}

export const FLOW_NAMES: Record<FlowMode, string> = {
  test: 'Purchase Requests flow (test site)',
  live: 'Purchase Requests flow'
};

const SP = 'shared_sharepointonline';
const OUTLOOK = 'shared_office365';
const API = (name: string) => `/providers/Microsoft.PowerApps/apis/${name}`;
const ICONS: Record<string, { displayName: string; iconUri: string }> = {
  [SP]: {
    displayName: 'SharePoint',
    iconUri: 'https://conn-afd-prod-endpoint-bmc9bqahasf3grgk.b01.azurefd.net/v1.0.1779/1.0.1779.4440/sharepointonline/icon.png'
  },
  [OUTLOOK]: {
    displayName: 'Office 365 Outlook',
    iconUri: 'https://conn-afd-prod-endpoint-bmc9bqahasf3grgk.b01.azurefd.net/releases/v1.0.1788/1.0.1788.4524/office365/icon.png'
  }
};

/** Characters removed from the folder name, as a second check after the app's own rule. */
export const UNSAFE_FOLDER_CHARACTERS = ['"', '*', ':', '<', '>', '?', '/', '\\', '|', '#', '%', '~', '&', '{', '}', "'", '..'];
const CONTROL_CHARACTERS = ['%09', '%0A', '%0D'];
const MAX_FOLDER_NAME = 120;

/** A string literal in Power Automate's expression language. */
export function lit(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

/** An expression that removes every unsafe character from a value. */
export function cleanExpression(value: string): string {
  let e = `coalesce(${value}, '')`;
  for (const ch of UNSAFE_FOLDER_CHARACTERS) e = `replace(${e}, ${lit(ch)}, '-')`;
  for (const code of CONTROL_CHARACTERS) e = `replace(${e}, decodeUriComponent('${code}'), '-')`;
  return `trim(${e})`;
}

/** An expression that escapes text for HTML and keeps its line breaks (D-067). */
export function htmlTextExpression(value: string): string {
  let e = `coalesce(${value}, '')`;
  for (const [ch, entity] of [
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;']
  ]) {
    e = `replace(${e}, ${lit(ch)}, ${lit(entity)})`;
  }
  e = `replace(${e}, decodeUriComponent('%0D'), '')`;
  return `replace(${e}, decodeUriComponent('%0A'), '<br>')`;
}

/** Text for an HTML attribute written into the email template. */
function attr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sitePath(siteUrl: string): string {
  return new URL(siteUrl).pathname.replace(/\/$/, '');
}

function spHost(operationId: string): Record<string, string> {
  return { apiId: API(SP), connectionName: SP, operationId };
}

/** A "Send an HTTP request to SharePoint" action on the destination site. */
function http(config: FlowConfig, method: 'GET' | 'POST', uri: string, runAfter: Record<string, string[]>): Record<string, unknown> {
  return {
    runAfter,
    type: 'OpenApiConnection',
    inputs: {
      host: spHost('HttpRequest'),
      parameters: {
        dataset: config.destinationSiteUrl,
        'parameters/method': method,
        'parameters/uri': uri,
        'parameters/headers': { Accept: 'application/json;odata=verbose' }
      },
      authentication: "@parameters('$authentication')"
    }
  };
}

function patchSubmission(runAfter: Record<string, string[]>, config: FlowConfig, fields: Record<string, string>): Record<string, unknown> {
  const item: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) item[`item/${k}`] = v;
  return {
    runAfter,
    type: 'OpenApiConnection',
    inputs: {
      host: spHost('PatchItem'),
      parameters: { dataset: config.siteUrl, table: config.submissionsListId, id: "@triggerBody()?['ID']", ...item },
      authentication: "@parameters('$authentication')"
    }
  };
}

function email(runAfter: Record<string, string[]>, to: string, subject: string, body: string): Record<string, unknown> {
  return {
    runAfter,
    type: 'OpenApiConnection',
    inputs: {
      host: { apiId: API(OUTLOOK), connectionName: OUTLOOK, operationId: 'SendEmailV2' },
      parameters: { 'emailMessage/To': to, 'emailMessage/Subject': subject, 'emailMessage/Body': body, 'emailMessage/Importance': 'Normal' },
      authentication: "@parameters('$authentication')"
    }
  };
}

const OK = ['Succeeded'];
const EMAIL_STYLE = 'font-family: Segoe UI, Arial, sans-serif; font-size: 14px; color: #24142F;';

/** Says what failed in the approval branch: sending the email, or recording that it was sent (A2). */
const APPROVAL_FAILED = 'Sending the approval email, or recording that it was sent, failed';

/**
 * The flow's definition: trigger, claim, the approval branch and the packaging
 * branch, each with its failure handling (strategy section 8). Throws if the
 * config does not pass checkFlowConfig.
 */
export function buildFlowDefinition(config: FlowConfig): Record<string, unknown> {
  return definitionOf(checkFlowConfig(config));
}

function definitionOf(config: CheckedFlowConfig): Record<string, unknown> {
  const destPath = `${sitePath(config.destinationSiteUrl)}/${config.libraryUrlName}`;
  const landing = config.folders[config.folders.length - 1];
  const landingServerPath = `${destPath}/${landing}`;
  const origin = new URL(config.destinationSiteUrl).origin;
  const safeName = "outputs('Safe_folder_name')";
  const reportFolderServerPath = `concat(${lit(landingServerPath + '/')}, ${safeName})`;
  const folderLink = `concat(${lit(origin + encodeURI(landingServerPath) + '/')}, encodeUriComponent(${safeName}))`;
  const landingLink = origin + encodeURI(landingServerPath);
  // Folder addresses go in as plain text: the cleaned name has no quotes, # or %.
  // A folder address inside the REST path: fixed text, or an expression for the request folder.
  const pathPart = (path: { text: string } | { expression: string }) => ('text' in path ? path.text.replace(/'/g, "''") : `@{${path.expression}}`);
  const existsUri = (path: { text: string } | { expression: string }) => `_api/web/GetFolderByServerRelativeUrl('${pathPart(path)}')/Exists`;
  const createUri = (path: { text: string } | { expression: string }) => `_api/web/folders/addUsingPath(decodedurl='${pathPart(path)}')`;
  // The page's origin and path only (checkFlowConfig), so nothing from a query string reaches the email links.
  const appUrl = attr(config.appPageUrl);
  // Where the app opens a request (the approver's and the administrator's page).
  const requestLink = `${appUrl}#/admin/request/@{triggerBody()?['RequestId']}`;
  const exists = (action: string) => `@body('${action}')?['d']?['Exists']`;
  const runLink =
    "concat('https://make.powerautomate.com/environments/', workflow()?['tags']?['environmentName'], '/flows/', workflow()?['name'], '/runs/', workflow()?['run']?['name'])";

  // Package scope (the packaging branch): folders, file copies, status and email.
  const pkg: Record<string, unknown> = {};
  pkg.Cleaned_folder_name = { runAfter: {}, type: 'Compose', inputs: `@${cleanExpression("triggerBody()?['FolderName']")}` };
  pkg.Safe_folder_name = {
    runAfter: { Cleaned_folder_name: OK },
    type: 'Compose',
    inputs:
      "@if(empty(outputs('Cleaned_folder_name')), concat('Submission-', string(triggerBody()?['ID'])), " +
      `substring(outputs('Cleaned_folder_name'), 0, min(length(outputs('Cleaned_folder_name')), ${MAX_FOLDER_NAME})))`
  };
  pkg.Get_attachments = {
    runAfter: { Safe_folder_name: OK },
    type: 'OpenApiConnection',
    inputs: {
      host: spHost('GetItemAttachments'),
      parameters: { dataset: config.siteUrl, table: config.submissionsListId, itemId: "@triggerBody()?['ID']" },
      authentication: "@parameters('$authentication')"
    }
  };
  // The landing folders are created on the first run only (never year folders, D-009).
  let previous = 'Get_attachments';
  config.folders.forEach((folder, i) => {
    const serverPath = { text: `${destPath}/${folder}` };
    const check = `Check_folder_${i + 1}`;
    const cond = `If_folder_${i + 1}_is_missing`;
    pkg[check] = http(config, 'GET', existsUri(serverPath), { [previous]: OK });
    pkg[cond] = {
      runAfter: { [check]: OK },
      type: 'If',
      expression: { and: [{ equals: [exists(check), false] }] },
      actions: { [`Create_folder_${i + 1}`]: http(config, 'POST', createUri(serverPath), {}) },
      else: { actions: {} }
    };
    previous = cond;
  });
  pkg.Check_report_folder = http(config, 'GET', existsUri({ expression: reportFolderServerPath }), { [previous]: OK });

  const summaryHtml = `@{${htmlTextExpression("triggerBody()?['EmailSummary']")}}`;
  const heading = "@{if(greater(triggerBody()?['SubmissionNumber'], 1), 'Purchase request resubmitted', 'Purchase request submitted')}";
  const notification =
    `<div style="${EMAIL_STYLE}"><h3>${heading}</h3><p>${summaryHtml}</p>` +
    `<p><b>Folder:</b> <a href="@{${folderLink}}">@{${safeName}}</a><br>` +
    `<b>All requests waiting:</b> <a href="${landingLink}">${landing.split('/').pop()}</a><br>` +
    `<b>Open the request in Purchase Requests:</b> <a href="${requestLink}">Purchase Requests</a></p></div>`;
  const reportLabel = "@{coalesce(triggerBody()?['Title'], 'a purchase request')}";

  const packaged: Record<string, unknown> = {
    Create_report_folder: http(config, 'POST', createUri({ expression: reportFolderServerPath }), {}),
    Copy_files: {
      runAfter: { Create_report_folder: OK },
      type: 'Foreach',
      foreach: "@body('Get_attachments')",
      runtimeConfiguration: { concurrency: { repetitions: 1 } },
      actions: {
        Get_attachment_content: {
          runAfter: {},
          type: 'OpenApiConnection',
          inputs: {
            host: spHost('GetAttachmentContent'),
            parameters: {
              dataset: config.siteUrl,
              table: config.submissionsListId,
              itemId: "@triggerBody()?['ID']",
              attachmentId: "@items('Copy_files')?['Id']"
            },
            authentication: "@parameters('$authentication')"
          }
        },
        Create_file: {
          runAfter: { Get_attachment_content: OK },
          type: 'OpenApiConnection',
          inputs: {
            host: spHost('CreateFile'),
            parameters: {
              dataset: config.destinationSiteUrl,
              folderPath: `@{concat(${lit(`/${config.libraryUrlName}/${landing}/`)}, ${safeName})}`,
              name: "@items('Copy_files')?['DisplayName']",
              body: "@body('Get_attachment_content')"
            },
            authentication: "@parameters('$authentication')"
          },
          runtimeConfiguration: { contentTransfer: { transferMode: 'Chunked' } }
        }
      }
    },
    Mark_packaged: patchSubmission({ Copy_files: OK }, config, {
      'PackageStatus/Value': 'Packaged',
      FolderLink: `@{${folderLink}}`,
      PackagedAt: '@{utcNow()}',
      ErrorMessage: ''
    }),
    Send_notification: email({ Mark_packaged: OK }, config.adminEmail, "@{triggerBody()?['EmailSubject']}", notification)
  };

  const stopReason =
    "@{if(equals(body('Check_report_folder')?['d']?['Exists'], true), " +
    lit(
      'A folder with this name already exists in Purchases_To_Process, so nothing was copied or overwritten. Delete that folder, then choose Retry packaging.'
    ) +
    ', ' +
    lit('The submission has no files to copy. Ask the employee to submit again.') +
    ')}';
  const notPackaged: Record<string, unknown> = {
    Mark_not_packaged: patchSubmission({}, config, { 'PackageStatus/Value': 'Failed', ErrorMessage: stopReason }),
    Send_not_packaged_email: email(
      { Mark_not_packaged: OK },
      config.adminEmail,
      `Purchase request not packaged: ${reportLabel}`,
      `<div style="${EMAIL_STYLE}"><p>${stopReason}</p><p><a href="${appUrl}#/admin/attention">Open Needs attention</a></p></div>`
    )
  };

  pkg.If_the_report_folder_is_new = {
    runAfter: { Check_report_folder: OK },
    type: 'If',
    expression: { and: [{ equals: [exists('Check_report_folder'), false] }, { greater: ["@length(body('Get_attachments'))", 0] }] },
    actions: packaged,
    else: { actions: notPackaged }
  };

  const failureText = "@{coalesce(first(body('Failed_steps'))?['error']?['message'], 'Packaging stopped. See the flow run.')}";
  const onFailure: Record<string, unknown> = {
    Failed_steps: { runAfter: {}, type: 'Query', inputs: { from: "@result('Package')", where: "@equals(item()?['status'], 'Failed')" } },
    Mark_failed: patchSubmission({ Failed_steps: OK }, config, { 'PackageStatus/Value': 'Failed', ErrorMessage: failureText }),
    Send_failure_email: email(
      { Mark_failed: ['Succeeded', 'Failed'] },
      config.adminEmail,
      `Purchase request packaging failed: ${reportLabel}`,
      `<div style="${EMAIL_STYLE}"><p>Packaging failed: @{${htmlTextExpression(failureText.slice(2, -1))}}</p>` +
        `<p><a href="@{${runLink}}">Open the flow run</a> &middot; <a href="${appUrl}#/admin/attention">Open Needs attention</a></p></div>`
    )
  };

  // Approval scope (the approval branch, P-018): one email to the approvers, then the status. It creates no
  // folder and no file. The recipients come from the config, fixed in the package, never from the list item.
  const approvalHeading = "@{if(greater(triggerBody()?['SubmissionNumber'], 1), 'Purchase approval needed again', 'Purchase approval needed')}";
  const approvalNotice =
    `<div style="${EMAIL_STYLE}"><h3>${approvalHeading}</h3><p>${summaryHtml}</p>` +
    `<p>Open the request in Purchase Requests to approve it, confirm the categories, or return it with a note: <a href="${requestLink}">Purchase Requests</a></p></div>`;
  const approval: Record<string, unknown> = {
    Send_approval_email: email({}, config.approvalRecipients.join(';'), "@{triggerBody()?['EmailSubject']}", approvalNotice),
    Mark_approval_sent: patchSubmission({ Send_approval_email: OK }, config, { 'PackageStatus/Value': 'Packaged', PackagedAt: '@{utcNow()}', ErrorMessage: '' })
  };

  // The error of the step that failed, read the way the packaging branch reads it, or a fixed sentence. Nothing
  // reads into the step's outputs: an output body can be text, and selecting a property of text fails the
  // expression itself, which would leave the item Processing with no email (Unverified, flow/FLOW.md).
  const approvalError = `coalesce(first(body('Failed_approval_steps'))?['error']?['message'], ${lit(`${APPROVAL_FAILED}. See the flow run.`)})`;
  const onApprovalFailure: Record<string, unknown> = {
    Failed_approval_steps: { runAfter: {}, type: 'Query', inputs: { from: "@result('Approval_email')", where: "@equals(item()?['status'], 'Failed')" } },
    Mark_approval_failed: patchSubmission({ Failed_approval_steps: OK }, config, { 'PackageStatus/Value': 'Failed', ErrorMessage: `@{${approvalError}}` }),
    // The administrator is told even if recording the failure failed or timed out.
    Send_approval_failure_email: email(
      { Mark_approval_failed: ['Succeeded', 'Failed', 'TimedOut'] },
      config.adminEmail,
      `Purchase approval email failed: ${reportLabel}`,
      `<div style="${EMAIL_STYLE}"><p>${APPROVAL_FAILED}: @{${htmlTextExpression(approvalError)}}</p>` +
        `<p><a href="@{${runLink}}">Open the flow run</a> &middot; <a href="${appUrl}#/admin/attention">Open Needs attention</a></p></div>`
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
      When_a_submission_is_ready: {
        recurrence: { frequency: 'Minute', interval: 5 },
        splitOn: "@triggerOutputs()?['body/value']",
        type: 'OpenApiConnection',
        conditions: [{ expression: "@equals(triggerBody()?['PackageStatus']?['Value'], 'Ready')" }],
        runtimeConfiguration: { concurrency: { runs: 1 } },
        inputs: {
          host: spHost('GetOnUpdatedItems'),
          parameters: { dataset: config.siteUrl, table: config.submissionsListId },
          authentication: "@parameters('$authentication')"
        }
      }
    },
    actions: {
      Claim_the_submission: patchSubmission({}, config, { 'PackageStatus/Value': 'Processing' }),
      // Choice columns are read through ?['Value'], as PackageStatus is in the trigger. Anything that is not
      // an approval request (including an empty type) is handled as a processing package.
      If_this_is_an_approval_request: {
        runAfter: { Claim_the_submission: OK },
        type: 'If',
        expression: { and: [{ equals: ["@triggerBody()?['SubmissionType']?['Value']", 'Approval request'] }] },
        actions: {
          Approval_email: { runAfter: {}, type: 'Scope', actions: approval },
          On_approval_failure: { runAfter: { Approval_email: ['Failed', 'TimedOut'] }, type: 'Scope', actions: onApprovalFailure }
        },
        else: {
          actions: {
            Package: { runAfter: {}, type: 'Scope', actions: pkg },
            On_failure: { runAfter: { Package: ['Failed', 'TimedOut'] }, type: 'Scope', actions: onFailure }
          }
        }
      }
    }
  };
}

export interface FlowPackage {
  fileName: string;
  zip: Uint8Array;
  /** The files inside, for checks and the example in flow/. */
  files: Record<string, string>;
  /** Who the approval email goes to, as fixed in the package: the approvers, or the administrator if there are none. */
  approvalRecipients: string[];
}

/** The legacy import package: manifests, connection maps and the definition. Throws if the config does not pass checkFlowConfig. */
export function buildFlowPackage(config: FlowConfig, newId: () => string = () => crypto.randomUUID(), now: Date = new Date()): FlowPackage {
  const checked = checkFlowConfig(config);
  const flowId = newId();
  const ids: Record<string, { api: string; connection: string }> = {
    [SP]: { api: newId(), connection: newId() },
    [OUTLOOK]: { api: newId(), connection: newId() }
  };
  const displayName = FLOW_NAMES[config.mode];
  const resources: Record<string, unknown> = {
    [flowId]: {
      type: 'Microsoft.Flow/flows',
      suggestedCreationType: 'New',
      creationType: 'Existing, New, Update',
      details: { displayName },
      configurableBy: 'User',
      hierarchy: 'Root',
      dependsOn: [ids[SP].api, ids[SP].connection, ids[OUTLOOK].api, ids[OUTLOOK].connection]
    }
  };
  const connectionReferences: Record<string, unknown> = {};
  for (const api of [SP, OUTLOOK]) {
    resources[ids[api].api] = {
      id: API(api),
      name: api,
      type: 'Microsoft.PowerApps/apis',
      suggestedCreationType: 'Existing',
      details: ICONS[api],
      configurableBy: 'System',
      hierarchy: 'Child',
      dependsOn: []
    };
    resources[ids[api].connection] = {
      type: 'Microsoft.PowerApps/apis/connections',
      suggestedCreationType: 'Existing',
      creationType: 'Existing',
      details: ICONS[api],
      configurableBy: 'User',
      hierarchy: 'Child',
      dependsOn: [ids[api].api]
    };
    connectionReferences[api] = {
      connectionName: `${api.replace('shared_', 'shared-')}-${ids[api].connection}`,
      source: 'Embedded',
      id: API(api),
      tier: 'NotSpecified'
    };
  }
  const manifest = {
    schema: '1.0',
    details: {
      displayName,
      description:
        'Emails the approvers when a purchase request needs approval, creates the request folder for each submitted purchase request and emails the administrator. Generated by the Purchase Requests Set-up page.',
      createdTime: now.toISOString(),
      packageTelemetryId: newId(),
      creator: 'N/A',
      sourceEnvironment: ''
    },
    resources
  };
  const definition = {
    name: flowId,
    id: `/providers/Microsoft.Flow/flows/${flowId}`,
    type: 'Microsoft.Flow/flows',
    properties: {
      apiId: API('shared_logicflows'),
      displayName,
      definition: definitionOf(checked),
      connectionReferences,
      flowFailureAlertSubscribed: false,
      isManaged: false
    }
  };
  const base = `Microsoft.Flow/flows/${flowId}`;
  const files: Record<string, string> = {
    'manifest.json': JSON.stringify(manifest, null, 2),
    'Microsoft.Flow/flows/manifest.json': JSON.stringify({ packageSchemaVersion: '1.0', flowAssets: { assetPaths: [flowId] } }),
    [`${base}/definition.json`]: JSON.stringify(definition, null, 2),
    [`${base}/apisMap.json`]: JSON.stringify({ [SP]: ids[SP].api, [OUTLOOK]: ids[OUTLOOK].api }),
    [`${base}/connectionsMap.json`]: JSON.stringify({ [SP]: ids[SP].connection, [OUTLOOK]: ids[OUTLOOK].connection })
  };
  return {
    fileName: `PurchaseRequests_Flow_${config.mode === 'test' ? 'Test' : 'Live'}.zip`,
    zip: buildZip(
      Object.entries(files).map(([path, content]) => ({ path, content })),
      now
    ),
    files,
    approvalRecipients: checked.approvalRecipients
  };
}
