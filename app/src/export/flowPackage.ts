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

import { buildZip } from './zip';

export type FlowMode = 'test' | 'live';

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
  /** The page the app runs on, for the "open the request" links. */
  appPageUrl: string;
}

/** The fixed live destination (strategy section 7). */
export const LIVE_DESTINATION = {
  siteUrl: 'https://claruslabsusa.sharepoint.com/sites/ExecutiveTeam',
  libraryUrlName: 'Shared Documents',
  /** Must already exist; the flow never creates or changes it. */
  existingParent: '01_Company Documents/Accounting',
  folders: ['01_Company Documents/Accounting/Purchases', '01_Company Documents/Accounting/Purchases/Purchases_To_Process']
} as const;

/** The test destination: the test site's own library, outside Accounting (strategy section 10). */
export const TEST_FOLDERS = ['Purchases_Test', 'Purchases_Test/Purchases_To_Process'];

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

/** The flow's definition: trigger, claim, the approval branch and the packaging branch, each with its failure handling (strategy section 8). */
export function buildFlowDefinition(config: FlowConfig): Record<string, unknown> {
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
  const approvers = config.approverEmails.map((address) => address.trim()).filter((address) => address !== '');
  const approvalHeading = "@{if(greater(triggerBody()?['SubmissionNumber'], 1), 'Purchase approval needed again', 'Purchase approval needed')}";
  const approvalNotice =
    `<div style="${EMAIL_STYLE}"><h3>${approvalHeading}</h3><p>${summaryHtml}</p>` +
    `<p>Open the request in Purchase Requests to approve it, confirm the categories, or return it with a note: <a href="${requestLink}">Purchase Requests</a></p></div>`;
  const approval: Record<string, unknown> = {
    Send_approval_email: email({}, approvers.length > 0 ? approvers.join(';') : config.adminEmail, "@{triggerBody()?['EmailSubject']}", approvalNotice),
    Mark_approval_sent: patchSubmission({ Send_approval_email: OK }, config, { 'PackageStatus/Value': 'Packaged', PackagedAt: '@{utcNow()}', ErrorMessage: '' })
  };

  const approvalFailureText = "@{coalesce(first(body('Failed_approval_steps'))?['error']?['message'], 'The approval email was not sent. See the flow run.')}";
  const onApprovalFailure: Record<string, unknown> = {
    Failed_approval_steps: { runAfter: {}, type: 'Query', inputs: { from: "@result('Approval_email')", where: "@equals(item()?['status'], 'Failed')" } },
    Mark_approval_failed: patchSubmission({ Failed_approval_steps: OK }, config, { 'PackageStatus/Value': 'Failed', ErrorMessage: approvalFailureText }),
    Send_approval_failure_email: email(
      { Mark_approval_failed: ['Succeeded', 'Failed'] },
      config.adminEmail,
      `Purchase approval email failed: ${reportLabel}`,
      `<div style="${EMAIL_STYLE}"><p>The approval email failed: @{${htmlTextExpression(approvalFailureText.slice(2, -1))}}</p>` +
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
}

/** The legacy import package: manifests, connection maps and the definition. */
export function buildFlowPackage(config: FlowConfig, newId: () => string = () => crypto.randomUUID(), now: Date = new Date()): FlowPackage {
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
      definition: buildFlowDefinition(config),
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
    files
  };
}
