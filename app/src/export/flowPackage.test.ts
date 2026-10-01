import {
  FLOW_NAMES,
  FlowConfig,
  LIVE_DESTINATION,
  TEST_FOLDERS,
  UNSAFE_FOLDER_CHARACTERS,
  buildFlowDefinition,
  buildFlowPackage,
  cleanExpression,
  htmlTextExpression,
  lit
} from './flowPackage';
import { LISTS, PACKAGE_STATUSES, SUBMISSION_TYPE_LABELS } from '../data/sharepoint/schema';
import { crc32 } from './zip';

const live: FlowConfig = {
  mode: 'live',
  siteUrl: 'https://contoso.sharepoint.com/sites/FormsAndApps',
  submissionsListId: '11111111-2222-3333-4444-555555555555',
  destinationSiteUrl: LIVE_DESTINATION.siteUrl,
  libraryUrlName: LIVE_DESTINATION.libraryUrlName,
  folders: [...LIVE_DESTINATION.folders],
  adminEmail: 'admin@example.com',
  approverEmails: ['approver.one@example.com', 'approver.two@example.com'],
  appPageUrl: 'https://contoso.sharepoint.com/sites/FormsAndApps/SitePages/Purchase-Requests.aspx'
};
const testSite: FlowConfig = { ...live, mode: 'test', destinationSiteUrl: live.siteUrl, libraryUrlName: 'Shared Documents', folders: [...TEST_FOLDERS] };

let counter = 0;
const ids = () => `00000000-0000-0000-0000-${String(++counter).padStart(12, '0')}`;

interface FlowAction {
  type: string;
  runAfter: Record<string, string[]>;
  expression?: unknown;
  inputs?: { host?: { operationId?: string }; parameters?: Record<string, unknown>; from?: string; where?: string };
  actions?: Record<string, FlowAction>;
  else?: { actions: Record<string, FlowAction> };
}

interface FlowDefinition {
  triggers: Record<string, { conditions: { expression: string }[]; inputs: { parameters: Record<string, string> }; runtimeConfiguration: unknown }>;
  actions: Record<string, FlowAction>;
}

interface Found {
  name: string;
  action: FlowAction;
  /** The actions that sit beside this one: its runAfter can only name these. */
  container: Record<string, FlowAction>;
  /** A top-level action is level 1. */
  depth: number;
}

/** Every action at any depth, parents first, in the order they are written. */
function walk(container: Record<string, FlowAction>, depth = 1, found: Found[] = []): Found[] {
  for (const [name, action] of Object.entries(container)) {
    found.push({ name, action, container, depth });
    if (action.actions) walk(action.actions, depth + 1, found);
    if (action.else) walk(action.else.actions, depth + 1, found);
  }
  return found;
}

/** The actions inside a scope, a condition's Yes branch or a loop. */
const inside = (action: FlowAction): Record<string, FlowAction> => action.actions as Record<string, FlowAction>;
/** The actions inside a condition's No branch. */
const otherwise = (action: FlowAction): Record<string, FlowAction> => (action.else as { actions: Record<string, FlowAction> }).actions;
const param = (action: FlowAction, key: string): string => String(action.inputs?.parameters?.[key]);
const operationOf = (found: Found): string | undefined => found.action.inputs?.host?.operationId;

/** Every text matched by the first group of a pattern, once each. */
function groupsOf(json: string, pattern: RegExp): string[] {
  const found = new Set<string>();
  for (let m = pattern.exec(json); m !== null; m = pattern.exec(json)) found.add(m[1]);
  return [...found];
}

const build = (config: FlowConfig): FlowDefinition => buildFlowDefinition(config) as unknown as FlowDefinition;
const approvalMailOf = (config: FlowConfig): FlowAction =>
  inside(inside(build(config).actions.If_this_is_an_approval_request).Approval_email).Send_approval_email;

describe('flow expressions', () => {
  it('writes string literals with doubled single quotes', () => {
    expect(lit("O'Brien")).toBe("'O''Brien'");
  });

  it('removes every unsafe character from the folder name', () => {
    const e = cleanExpression("triggerBody()?['FolderName']");
    for (const ch of UNSAFE_FOLDER_CHARACTERS) expect(e).toContain(`, ${lit(ch)}, '-')`);
    expect(e).toContain("decodeUriComponent('%0A')");
    expect(e.startsWith('trim(')).toBe(true);
  });

  it('escapes stored text before it goes into the email (travel D-067)', () => {
    const e = htmlTextExpression("triggerBody()?['EmailSummary']");
    // "&" first, so the entities that follow are not escaped twice.
    expect(e.indexOf("'&amp;'")).toBeLessThan(e.indexOf("'&lt;'"));
    expect(e).toContain("'<', '&lt;'");
    expect(e).toContain("'\"', '&quot;'");
    expect(e).toContain("decodeUriComponent('%0A'), '<br>')");
  });
});

describe('the Purchase Requests flow (strategy section 8, P-018)', () => {
  const definition = build(live);
  const text = JSON.stringify(definition);
  const choice = definition.actions.If_this_is_an_approval_request;
  const approvalBranch = inside(choice);
  const packagingBranch = otherwise(choice);
  const all = walk(definition.actions);

  describe('the trigger and the claim', () => {
    it('starts only for submissions marked Ready, one at a time', () => {
      const trigger = definition.triggers.When_a_submission_is_ready;
      expect(trigger.conditions[0].expression).toBe("@equals(triggerBody()?['PackageStatus']?['Value'], 'Ready')");
      expect(trigger.inputs.parameters).toEqual({ dataset: live.siteUrl, table: live.submissionsListId });
      expect(trigger.runtimeConfiguration).toEqual({ concurrency: { runs: 1 } });
    });

    it('claims the submission first, then branches on its type', () => {
      expect(Object.keys(definition.actions)).toEqual(['Claim_the_submission', 'If_this_is_an_approval_request']);
      expect(definition.actions.Claim_the_submission.runAfter).toEqual({});
      expect(param(definition.actions.Claim_the_submission, 'item/PackageStatus/Value')).toBe('Processing');
      expect(choice.type).toBe('If');
      expect(choice.runAfter).toEqual({ Claim_the_submission: ['Succeeded'] });
    });

    it('takes the approval branch only when the type is Approval request, read as a choice value', () => {
      expect(choice.expression).toEqual({ and: [{ equals: ["@triggerBody()?['SubmissionType']?['Value']", 'Approval request'] }] });
      // The label the Purchase Submissions list offers, so a renamed choice cannot silently break the branch.
      expect(SUBMISSION_TYPE_LABELS.approval).toBe('Approval request');
      // Everything else, an empty type included, is a processing package.
      expect(Object.keys(packagingBranch)).toEqual(['Package', 'On_failure']);
    });
  });

  describe('the approval branch', () => {
    const scope = approvalBranch.Approval_email;
    const send = inside(scope).Send_approval_email;
    const sendBody = param(send, 'emailMessage/Body');
    const failure = approvalBranch.On_approval_failure;

    it('is an approval scope and its own failure scope, nothing else', () => {
      expect(Object.keys(approvalBranch)).toEqual(['Approval_email', 'On_approval_failure']);
      expect(scope.type).toBe('Scope');
      expect(scope.runAfter).toEqual({});
      expect(Object.keys(inside(scope))).toEqual(['Send_approval_email', 'Mark_approval_sent']);
      expect(inside(scope).Mark_approval_sent.runAfter).toEqual({ Send_approval_email: ['Succeeded'] });
    });

    it('emails every approver in one message, with the addresses joined by semicolons', () => {
      expect(send.inputs?.host?.operationId).toBe('SendEmailV2');
      expect(param(send, 'emailMessage/To')).toBe('approver.one@example.com;approver.two@example.com');
      expect(param(send, 'emailMessage/Subject')).toBe("@{triggerBody()?['EmailSubject']}");
    });

    it('takes the addresses only from the package, never from the list item', () => {
      const to = param(send, 'emailMessage/To');
      expect(to.split(';')).toEqual(live.approverEmails);
      expect(to).not.toMatch(/triggerBody|@\{|^@/);
      // The same holds for every email the flow can send.
      const mails = all.filter((f) => operationOf(f) === 'SendEmailV2');
      expect(mails.map((f) => f.name).sort()).toEqual(
        ['Send_approval_email', 'Send_approval_failure_email', 'Send_failure_email', 'Send_not_packaged_email', 'Send_notification'].sort()
      );
      for (const mail of mails) expect(param(mail.action, 'emailMessage/To')).not.toMatch(/triggerBody|@\{|^@/);
      expect(new Set(mails.map((f) => param(f.action, 'emailMessage/To')))).toEqual(
        new Set(['approver.one@example.com;approver.two@example.com', 'admin@example.com'])
      );
    });

    it('falls back to the administrator when the package has no approver address', () => {
      expect(param(approvalMailOf({ ...live, approverEmails: [] }), 'emailMessage/To')).toBe('admin@example.com');
      expect(param(approvalMailOf({ ...live, approverEmails: ['', '  '] }), 'emailMessage/To')).toBe('admin@example.com');
      expect(param(approvalMailOf({ ...live, approverEmails: [' approver.one@example.com ', ''] }), 'emailMessage/To')).toBe('approver.one@example.com');
    });

    it('says when approval is needed again', () => {
      expect(sendBody).toContain(
        "<h3>@{if(greater(triggerBody()?['SubmissionNumber'], 1), 'Purchase approval needed again', 'Purchase approval needed')}</h3>"
      );
    });

    it('escapes the summary the app stored before it goes into the email (travel D-067)', () => {
      expect(sendBody).toContain(`<p>@{${htmlTextExpression("triggerBody()?['EmailSummary']")}}</p>`);
      // The stored text is never placed in the email as it is; only the subject is plain text.
      expect(sendBody).not.toContain("@{triggerBody()?['EmailSummary']}");
    });

    it('links to the request in the app', () => {
      expect(sendBody).toContain(
        `Open the request in Purchase Requests to approve it, confirm the categories, or return it with a note: <a href="${live.appPageUrl}#/admin/request/@{triggerBody()?['RequestId']}">Purchase Requests</a>`
      );
    });

    it('marks the approval Packaged, with the time and no error, only after the email is sent', () => {
      const mark = inside(scope).Mark_approval_sent;
      expect(mark.inputs?.host?.operationId).toBe('PatchItem');
      expect(mark.inputs?.parameters).toEqual({
        dataset: live.siteUrl,
        table: live.submissionsListId,
        id: "@triggerBody()?['ID']",
        'item/PackageStatus/Value': 'Packaged',
        'item/PackagedAt': '@{utcNow()}',
        'item/ErrorMessage': ''
      });
    });

    it('has its own failure scope that marks the submission Failed and emails the administrator', () => {
      expect(failure.type).toBe('Scope');
      expect(failure.runAfter).toEqual({ Approval_email: ['Failed', 'TimedOut'] });
      const steps = inside(failure);
      expect(Object.keys(steps)).toEqual(['Failed_approval_steps', 'Mark_approval_failed', 'Send_approval_failure_email']);
      expect(steps.Failed_approval_steps.inputs).toEqual({ from: "@result('Approval_email')", where: "@equals(item()?['status'], 'Failed')" });
      expect(steps.Mark_approval_failed.runAfter).toEqual({ Failed_approval_steps: ['Succeeded'] });
      expect(param(steps.Mark_approval_failed, 'item/PackageStatus/Value')).toBe('Failed');
      expect(param(steps.Mark_approval_failed, 'item/ErrorMessage')).toContain("first(body('Failed_approval_steps'))?['error']?['message']");
      expect(steps.Send_approval_failure_email.runAfter).toEqual({ Mark_approval_failed: ['Succeeded', 'Failed'] });
      const mail = steps.Send_approval_failure_email;
      expect(param(mail, 'emailMessage/To')).toBe('admin@example.com');
      expect(param(mail, 'emailMessage/Subject')).toBe("Purchase approval email failed: @{coalesce(triggerBody()?['Title'], 'a purchase request')}");
      const body = param(mail, 'emailMessage/Body');
      // The error text is escaped; the links are to the flow run and to Needs attention.
      expect(body).toContain(
        htmlTextExpression("coalesce(first(body('Failed_approval_steps'))?['error']?['message'], 'The approval email was not sent. See the flow run.')")
      );
      expect(body).toContain("workflow()?['run']?['name']");
      expect(body).toContain(`<a href="${live.appPageUrl}#/admin/attention">Open Needs attention</a>`);
    });

    it('creates no folder, creates no file and does not touch the destination', () => {
      const inBranch = walk(approvalBranch);
      // Only status updates and email, in scopes: no loop, no condition, no other connector action.
      expect([...new Set(inBranch.map((f) => f.action.type))].sort()).toEqual(['OpenApiConnection', 'Query', 'Scope']);
      expect([...new Set(inBranch.map(operationOf).filter((operation) => operation !== undefined))].sort()).toEqual(['PatchItem', 'SendEmailV2']);
      const branchText = JSON.stringify(approvalBranch);
      expect(branchText).not.toMatch(/CreateFile|HttpRequest|GetItemAttachments|GetAttachmentContent|addUsingPath|folders\/|Exists/);
      expect(branchText).not.toContain(live.destinationSiteUrl);
      expect(branchText).not.toMatch(/Accounting|Purchases_To_Process/);
    });
  });

  describe('the packaging branch (the travel flow under the new names)', () => {
    const pkg = inside(packagingBranch.Package);

    it('has the travel flow actions, in the same order, in the No branch', () => {
      expect(walk(packagingBranch).map((f) => f.name)).toEqual([
        'Package',
        'Cleaned_folder_name',
        'Safe_folder_name',
        'Get_attachments',
        'Check_folder_1',
        'If_folder_1_is_missing',
        'Create_folder_1',
        'Check_folder_2',
        'If_folder_2_is_missing',
        'Create_folder_2',
        'Check_report_folder',
        'If_the_report_folder_is_new',
        'Create_report_folder',
        'Copy_files',
        'Get_attachment_content',
        'Create_file',
        'Mark_packaged',
        'Send_notification',
        'Mark_not_packaged',
        'Send_not_packaged_email',
        'On_failure',
        'Failed_steps',
        'Mark_failed',
        'Send_failure_email'
      ]);
    });

    it('starts the Package scope first in its branch, and handles its failure after it', () => {
      expect(packagingBranch.Package.type).toBe('Scope');
      expect(packagingBranch.Package.runAfter).toEqual({});
      expect(packagingBranch.On_failure.runAfter).toEqual({ Package: ['Failed', 'TimedOut'] });
      expect(pkg.Cleaned_folder_name.runAfter).toEqual({});
    });

    it('uses a fixed destination inside Purchases_To_Process, never a value from the list', () => {
      expect(text).toContain("/sites/ExecutiveTeam/Shared Documents/01_Company Documents/Accounting/Purchases/Purchases_To_Process/'");
      expect(text).toContain("'/Shared Documents/01_Company Documents/Accounting/Purchases/Purchases_To_Process/'");
      // The only list value in any path is the cleaned folder name.
      expect(text).not.toMatch(/folderPath":"@\{concat\([^)]*triggerBody/);
      expect(text).toContain("outputs('Safe_folder_name')");
    });

    it('creates Purchases and Purchases_To_Process only if missing, and never year folders', () => {
      expect(Object.keys(pkg).filter((k) => k.startsWith('If_folder_'))).toEqual(['If_folder_1_is_missing', 'If_folder_2_is_missing']);
      expect(text).not.toMatch(/Purchases\/20\d\d/);
    });

    it('never overwrites: stops if the request folder exists, and marks the submission Failed', () => {
      expect(text).toContain('A folder with this name already exists in Purchases_To_Process, so nothing was copied or overwritten.');
      expect(text).not.toMatch(/overwrite=true|nameConflictBehavior/i);
      expect(text).not.toMatch(/DeleteItem|DeleteFile|MoveFile|recycle/);
    });

    it('marks failures and emails the administrator', () => {
      const onFailure = packagingBranch.On_failure;
      expect(onFailure.runAfter).toEqual({ Package: ['Failed', 'TimedOut'] });
      expect(Object.keys(inside(onFailure))).toEqual(['Failed_steps', 'Mark_failed', 'Send_failure_email']);
      expect(text).toContain('"emailMessage/To":"admin@example.com"');
    });

    it('words the emails for purchase requests', () => {
      const newFolder = pkg.If_the_report_folder_is_new;
      const notification = inside(newFolder).Send_notification;
      const body = param(notification, 'emailMessage/Body');
      expect(param(notification, 'emailMessage/Subject')).toBe("@{triggerBody()?['EmailSubject']}");
      expect(body).toContain("<h3>@{if(greater(triggerBody()?['SubmissionNumber'], 1), 'Purchase request resubmitted', 'Purchase request submitted')}</h3>");
      expect(body).toContain(`<p>@{${htmlTextExpression("triggerBody()?['EmailSummary']")}}</p>`);
      expect(body).toContain('<b>All requests waiting:</b> <a href="https://claruslabsusa.sharepoint.com/sites/ExecutiveTeam/');
      expect(body).toContain('>Purchases_To_Process</a>');
      expect(body).toContain(
        `<b>Open the request in Purchase Requests:</b> <a href="${live.appPageUrl}#/admin/request/@{triggerBody()?['RequestId']}">Purchase Requests</a>`
      );

      const notPackaged = otherwise(newFolder).Send_not_packaged_email;
      expect(param(notPackaged, 'emailMessage/Subject')).toBe("Purchase request not packaged: @{coalesce(triggerBody()?['Title'], 'a purchase request')}");
      expect(param(notPackaged, 'emailMessage/Body')).toContain(`<a href="${live.appPageUrl}#/admin/attention">Open Needs attention</a>`);

      const failed = inside(packagingBranch.On_failure).Send_failure_email;
      expect(param(failed, 'emailMessage/Subject')).toBe("Purchase request packaging failed: @{coalesce(triggerBody()?['Title'], 'a purchase request')}");
      expect(param(failed, 'emailMessage/Body')).toContain(`<a href="${live.appPageUrl}#/admin/attention">Open Needs attention</a>`);
    });

    it('can send test runs to the test site instead of Accounting', () => {
      const test = JSON.stringify(build(testSite));
      expect(test).toContain('/sites/FormsAndApps/Shared Documents/Purchases_Test/Purchases_To_Process');
      expect(test).not.toContain('Accounting');
      expect(test).not.toContain('ExecutiveTeam');
    });
  });

  describe('the whole definition', () => {
    it('gives every action its own name, at any depth', () => {
      const names = all.map((f) => f.name);
      expect(names).toHaveLength(33);
      expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([]);
    });

    it('makes every runAfter point at an action in the same container, and starts every container', () => {
      expect(all.filter((f) => !f.action.runAfter).map((f) => f.name)).toEqual([]);
      const strays = all.filter((f) => Object.keys(f.action.runAfter).some((target) => target === f.name || !(target in f.container)));
      expect(strays.map((f) => f.name)).toEqual([]);
      for (const container of new Set(all.map((f) => f.container))) {
        expect(Object.values(container).some((action) => Object.keys(action.runAfter).length === 0)).toBe(true);
      }
    });

    it('nests actions five levels deep, one more than the travel flow (flow/FLOW.md point 1)', () => {
      expect(Math.max(...all.map((f) => f.depth))).toBe(5);
      expect(all.find((f) => f.depth === 5)?.name).toBe('Get_attachment_content');
    });

    it('uses only statuses and columns of the Purchase Submissions list', () => {
      const columns = new Set(['ID', 'Title', ...LISTS.submissions.fields.map((f) => f.name)]);
      const used = [...groupsOf(text, /triggerBody\(\)\?\['(\w+)'\]/g), ...groupsOf(text, /"item\/(\w+)/g)];
      expect(used.filter((name) => !columns.has(name))).toEqual([]);
      for (const status of ['Ready', 'Processing', 'Packaged', 'Failed']) expect(PACKAGE_STATUSES).toContain(status);
      expect(groupsOf(text, /"item\/PackageStatus\/Value":"(\w+)"/g).sort()).toEqual(['Failed', 'Packaged', 'Processing']);
    });

    it('never mentions anything outside the Purchases folders, or travel', () => {
      for (const json of [text, JSON.stringify(build(testSite)), ...Object.values(buildFlowPackage(live, ids).files)]) {
        expect(json).not.toMatch(/Receipts_To_Process|Tax Docs|Payroll/);
        expect(json).not.toMatch(/travel|\btrips?\b/i);
      }
      // The only folders under Accounting are the Purchases ones.
      expect(text).not.toMatch(/Accounting\/(?!Purchases)/);
    });

    it('talks only to the configured sites, the flow run page and the schema', () => {
      const hosts = [live.siteUrl, live.destinationSiteUrl, live.appPageUrl].map((url) => new URL(url).host);
      expect(groupsOf(text, /https?:\/\/([^/'"\\\s]+)/g).sort()).toEqual(
        [...new Set([...hosts, 'make.powerautomate.com', 'schema.management.azure.com'])].sort()
      );
    });

    it('creates files and folders only on the destination site, and only in the packaging branch', () => {
      const writers = all.filter((f) => ['CreateFile', 'HttpRequest'].includes(operationOf(f) ?? ''));
      expect(writers.map((f) => f.name)).toEqual([
        'Check_folder_1',
        'Create_folder_1',
        'Check_folder_2',
        'Create_folder_2',
        'Check_report_folder',
        'Create_report_folder',
        'Create_file'
      ]);
      for (const f of writers) expect(String(f.action.inputs?.parameters?.dataset)).toBe(live.destinationSiteUrl);
      expect(writers.every((f) => walk(packagingBranch).some((g) => g.action === f.action))).toBe(true);
    });
  });
});

describe('the fixed destinations (P-008)', () => {
  it('has the live destination folders exactly', () => {
    expect(LIVE_DESTINATION.siteUrl).toBe('https://claruslabsusa.sharepoint.com/sites/ExecutiveTeam');
    expect(LIVE_DESTINATION.libraryUrlName).toBe('Shared Documents');
    expect(LIVE_DESTINATION.folders).toEqual(['01_Company Documents/Accounting/Purchases', '01_Company Documents/Accounting/Purchases/Purchases_To_Process']);
    // Set-up checks that this folder exists, read only; the flow never creates it.
    expect(LIVE_DESTINATION.existingParent).toBe('01_Company Documents/Accounting');
  });

  it('has the test destination folders exactly, in the test site itself', () => {
    expect(TEST_FOLDERS).toEqual(['Purchases_Test', 'Purchases_Test/Purchases_To_Process']);
  });

  it('names the flow for the test site and for the live site', () => {
    expect(FLOW_NAMES).toEqual({ test: 'Purchase Requests flow (test site)', live: 'Purchase Requests flow' });
  });
});

describe('the import package', () => {
  const pkg = buildFlowPackage(live, ids, new Date(2026, 9, 1, 12, 0, 0));

  it('has the legacy package files, cross-referenced', () => {
    const names = Object.keys(pkg.files);
    const flowId = JSON.parse(pkg.files['Microsoft.Flow/flows/manifest.json']).flowAssets.assetPaths[0];
    expect(names).toEqual([
      'manifest.json',
      'Microsoft.Flow/flows/manifest.json',
      `Microsoft.Flow/flows/${flowId}/definition.json`,
      `Microsoft.Flow/flows/${flowId}/apisMap.json`,
      `Microsoft.Flow/flows/${flowId}/connectionsMap.json`
    ]);
    const definition = JSON.parse(pkg.files[`Microsoft.Flow/flows/${flowId}/definition.json`]);
    expect(definition.name).toBe(flowId);
    expect(definition.properties.displayName).toBe('Purchase Requests flow');
    expect(Object.keys(definition.properties.connectionReferences)).toEqual(['shared_sharepointonline', 'shared_office365']);
    const manifest = JSON.parse(pkg.files['manifest.json']);
    expect(manifest.resources[flowId].dependsOn).toHaveLength(4);
    expect(pkg.fileName).toBe('PurchaseRequests_Flow_Live.zip');
  });

  it('lists one flow and the SharePoint and Outlook connections', () => {
    const manifest = JSON.parse(pkg.files['manifest.json']);
    const resources = Object.values(manifest.resources) as { type: string; name?: string }[];
    expect(resources.filter((r) => r.type === 'Microsoft.Flow/flows')).toHaveLength(1);
    expect(resources.filter((r) => r.type === 'Microsoft.PowerApps/apis').map((r) => r.name)).toEqual(['shared_sharepointonline', 'shared_office365']);
    expect(resources.filter((r) => r.type === 'Microsoft.PowerApps/apis/connections')).toHaveLength(2);
    expect(resources).toHaveLength(5);
    expect(manifest.details.displayName).toBe('Purchase Requests flow');
    expect(manifest.details.description).toBe(
      'Emails the approvers when a purchase request needs approval, creates the request folder for each submitted purchase request and emails the administrator. Generated by the Purchase Requests Set-up page.'
    );
  });

  it('is named for the mode', () => {
    const test = buildFlowPackage(testSite, ids);
    expect(test.fileName).toBe('PurchaseRequests_Flow_Test.zip');
    expect(JSON.parse(test.files['manifest.json']).details.displayName).toBe('Purchase Requests flow (test site)');
  });

  it('is a valid zip of those files', () => {
    const view = new DataView(pkg.zip.buffer, pkg.zip.byteOffset, pkg.zip.byteLength);
    const end = pkg.zip.byteLength - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(5);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const firstName = new TextDecoder().decode(pkg.zip.subarray(30, 30 + view.getUint16(26, true)));
    expect(firstName).toBe('manifest.json');
    expect(view.getUint32(14, true)).toBe(crc32(new TextEncoder().encode(pkg.files['manifest.json'])));
  });

  it('computes standard CRC-32 values', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926');
  });
});
