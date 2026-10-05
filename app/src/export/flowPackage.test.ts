import {
  FLOW_NAMES,
  FlowConfig,
  LIVE_DESTINATION,
  MAX_APPROVERS,
  TEST_FOLDERS,
  TEST_LIBRARY_URL_NAME,
  UNSAFE_FOLDER_CHARACTERS,
  buildFlowDefinition,
  buildFlowPackage,
  checkFlowConfig,
  cleanExpression,
  htmlTextExpression,
  isSafeEmailAddress,
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
  approverSource: 'owners',
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

/** Every text value in a definition, at any depth, keys included (an If's operands sit in arrays). */
function textsIn(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') found.push(value);
  else if (Array.isArray(value)) value.forEach((v) => textsIn(v, found));
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      found.push(k);
      textsIn(v, found);
    }
  return found;
}

/**
 * The expressions in a text value, as Power Automate reads them: the whole value
 * when it starts with "@" (but not "@{" or "@@"), otherwise each "@{...}" in it,
 * which ends at the first "}" outside a quoted string.
 */
function expressionsIn(value: string): string[] {
  if (value.startsWith('@@')) return [];
  if (value.startsWith('@') && !value.startsWith('@{')) return [value.slice(1)];
  const found: string[] = [];
  for (let start = value.indexOf('@{'); start !== -1; start = value.indexOf('@{', start)) {
    let end = start + 2;
    for (let quoted = false; end < value.length; end++) {
      if (value[end] === "'") quoted = !quoted;
      else if (value[end] === '}' && !quoted) break;
    }
    found.push(value.slice(start + 2, end));
    start = end;
  }
  return found;
}

/** What is wrong with an expression's quotes and brackets, or "" if they are balanced. A doubled quote inside a string is a quote. */
function balanceProblem(expression: string): string {
  const open: string[] = [];
  let quoted = false;
  for (const ch of expression) {
    if (ch === "'") quoted = !quoted;
    else if (quoted) continue;
    else if (ch === '(' || ch === '[') open.push(ch);
    else if (ch === ')' || ch === ']') {
      if (open.pop() !== (ch === ')' ? '(' : '[')) return `unexpected ${ch} in ${expression}`;
    } else if (ch === '{' || ch === '}') return `brace outside a string in ${expression}`;
  }
  if (quoted) return `unclosed string in ${expression}`;
  return open.length > 0 ? `unclosed ${open.join('')} in ${expression}` : '';
}

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
    // The error expression stored in the item, without its "@{" and "}".
    const approvalError = param(inside(failure).Mark_approval_failed, 'item/ErrorMessage').slice(2, -1);

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
      expect(param(approvalMailOf({ ...live, approverEmails: [], approverSource: 'administrator' }), 'emailMessage/To')).toBe('admin@example.com');
      expect(param(approvalMailOf({ ...live, approverEmails: ['approver.one@example.com'] }), 'emailMessage/To')).toBe('approver.one@example.com');
      // Blank or padded entries are not tidied here: the data layer filters the addresses first, and anything else is refused.
      expect(() => build({ ...live, approverEmails: ['', '  '] })).toThrow('approver address');
      expect(() => build({ ...live, approverEmails: [' approver.one@example.com ', ''] })).toThrow('approver address');
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
      expect(param(steps.Mark_approval_failed, 'item/ErrorMessage')).toMatch(/^@\{coalesce\(.*\)\}$/);
      // The administrator is told even if recording the failure failed or timed out.
      expect(steps.Send_approval_failure_email.runAfter).toEqual({ Mark_approval_failed: ['Succeeded', 'Failed', 'TimedOut'] });
      const mail = steps.Send_approval_failure_email;
      expect(param(mail, 'emailMessage/To')).toBe('admin@example.com');
      expect(param(mail, 'emailMessage/Subject')).toBe("Purchase approval email failed: @{coalesce(triggerBody()?['Title'], 'a purchase request')}");
      const body = param(mail, 'emailMessage/Body');
      // It does not claim the email was not sent: only the status update may have failed. The error text is escaped;
      // the links are to the flow run and to Needs attention.
      expect(body).toContain(`<p>Sending the approval email, or recording that it was sent, failed: @{${htmlTextExpression(approvalError)}}</p>`);
      expect(body).not.toMatch(/approval email failed|was not sent/i);
      expect(body).toContain("workflow()?['run']?['name']");
      expect(body).toContain(`<a href="${live.appPageUrl}#/admin/attention">Open Needs attention</a>`);
    });

    it("stores the failed step's error message, or a fixed sentence, by the one path the packaging branch also uses", () => {
      expect(approvalError).toBe(
        "coalesce(first(body('Failed_approval_steps'))?['error']?['message'], 'Sending the approval email, or recording that it was sent, failed. See the flow run.')"
      );
      expect(balanceProblem(approvalError)).toBe('');
      // Nothing in the branch selects a property of a step's outputs: an output body can be text, and selecting a property
      // of text fails the expression itself, which would leave the item Processing with no email (Unverified, Claude's
      // knowledge of the expression language).
      expect(JSON.stringify(approvalBranch)).not.toContain("['outputs']");
      // The same text is stored in the item and quoted, escaped, in the email.
      const mail = param(inside(failure).Send_approval_failure_email, 'emailMessage/Body');
      expect(mail).toContain(`@{${htmlTextExpression(approvalError)}}`);
    });

    it('leaves the packaging failure scope exactly as in the travel flow', () => {
      const steps = inside(packagingBranch.On_failure);
      expect(param(steps.Mark_failed, 'item/ErrorMessage')).toBe(
        "@{coalesce(first(body('Failed_steps'))?['error']?['message'], 'Packaging stopped. See the flow run.')}"
      );
      expect(steps.Send_failure_email.runAfter).toEqual({ Mark_failed: ['Succeeded', 'Failed'] });
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

    it('writes every expression with balanced quotes and brackets, in both packages', () => {
      for (const config of [live, testSite]) {
        const expressions = textsIn(build(config)).flatMap(expressionsIn);
        expect(expressions.length).toBeGreaterThan(40);
        expect(expressions.map(balanceProblem).filter((problem) => problem !== '')).toEqual([]);
      }
      // The checker itself finds the mistakes it is there for.
      expect(expressionsIn("x @{coalesce(a, 'b}c')} y @{d}")).toEqual(["coalesce(a, 'b}c')", 'd']);
      expect(expressionsIn("@equals(item()?['status'], 'Failed')")).toEqual(["equals(item()?['status'], 'Failed')"]);
      expect(balanceProblem("coalesce(a, 'O''Brien')")).toBe('');
      expect(balanceProblem("coalesce(a, 'O'Brien')")).toContain('unclosed string');
      expect(balanceProblem("first(body('x')?['error']")).toContain('unclosed (');
      expect(balanceProblem("body('x'))")).toContain('unexpected )');
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
    // Set-up checks that this folder exists, read only, when it makes a live package; the flow neither checks nor creates it.
    expect(LIVE_DESTINATION.existingParent).toBe('01_Company Documents/Accounting');
    expect(JSON.stringify(build(live))).not.toContain("Accounting')/Exists");
  });

  it('has the test destination folders exactly, in the test site itself', () => {
    expect(TEST_FOLDERS).toEqual(['Purchases_Test', 'Purchases_Test/Purchases_To_Process']);
    expect(TEST_LIBRARY_URL_NAME).toBe('Shared Documents');
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

  it('says who the approval email goes to, as fixed in the package, so Set-up can show it', () => {
    expect(pkg.approvalRecipients).toEqual(['approver.one@example.com', 'approver.two@example.com']);
    const fallback = buildFlowPackage({ ...testSite, approverEmails: [], approverSource: 'administrator' }, ids);
    expect(fallback.approvalRecipients).toEqual(['admin@example.com']);
    const definition = Object.entries(fallback.files).find(([path]) => path.endsWith('/definition.json'))![1];
    expect(definition).toContain('"emailMessage/To": "admin@example.com"');
    expect(definition).not.toContain('approver.one@example.com');
  });

  it('is not made at all from settings the generator refuses', () => {
    let made = 0;
    const counted = () => {
      made++;
      return ids();
    };
    expect(() => buildFlowPackage({ ...live, approverEmails: ["@{triggerBody()?['SubmitterEmail']}"] }, counted)).toThrow('The flow package was not made');
    expect(() => buildFlowPackage({ ...live, folders: [] }, counted)).toThrow('The flow package was not made');
    expect(made).toBe(0);
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

describe('the generator refuses settings it cannot use safely (strategy section 7, P-008, P-018)', () => {
  const refused = 'The flow package was not made';
  const json = (config: FlowConfig): string => JSON.stringify(buildFlowDefinition(config));

  describe('email addresses', () => {
    it('accepts one plain address of at most 254 characters', () => {
      for (const address of ['approver.one@example.com', "o'brien@example.co.uk", 'first+tag@mail.example.com', 'a_b-c%d@ex-ample.org', 'MAX@EXAMPLE.COM']) {
        expect(isSafeEmailAddress(address)).toBe(true);
      }
      const local = (length: number) => 'a'.repeat(length - '@example.com'.length);
      expect(isSafeEmailAddress(`${local(254)}@example.com`)).toBe(true);
      expect(isSafeEmailAddress(`${local(255)}@example.com`)).toBe(false);
    });

    it('refuses anything the flow could read as an expression, markup or a second address', () => {
      const hostile = [
        "@{triggerBody()?['SubmitterEmail']}",
        '@example.com',
        "@concat('a@example.com')",
        'a@b.com;c@d.com',
        'a@b.com,c@d.com',
        'approver one@example.com',
        ' approver.one@example.com',
        'approver.one@example.com ',
        'approver.one@example.com\n',
        'a"b@example.com',
        'a\\b@example.com',
        'a`b@example.com',
        '<b>@example.com',
        'x@exa{mple}.com',
        'x@{outputs(1)}.com',
        'jöhn@example.com',
        'a@example',
        'a@b..com',
        'no-at-sign.example.com',
        ''
      ];
      for (const address of hostile) expect(isSafeEmailAddress(address)).toBe(false);
      expect(isSafeEmailAddress(undefined as unknown as string)).toBe(false);
    });

    it('refuses an approver address that is not plain, rather than tidying it', () => {
      const hostile = [
        "@{triggerBody()?['SubmitterEmail']}",
        'a@b.com;c@d.com',
        '@example.com',
        'approver one@example.com',
        'a"b@example.com',
        'a\\b@example.com'
      ];
      for (const address of hostile) {
        expect(() => buildFlowDefinition({ ...live, approverEmails: ['approver.one@example.com', address] })).toThrow(`${refused}: the approver address`);
      }
    });

    it("refuses an administrator's address that is not plain", () => {
      for (const adminEmail of ['', 'max@example.com;evil@example.com', "@{triggerBody()?['SubmitterEmail']}", '@example.com']) {
        expect(() => buildFlowDefinition({ ...live, adminEmail })).toThrow(`${refused}: the administrator's email address`);
      }
    });

    it('refuses to make a package with no one to email: no approvers and no administrator address', () => {
      expect(() => buildFlowDefinition({ ...live, approverEmails: [], approverSource: 'administrator', adminEmail: '' })).toThrow(refused);
    });

    it(`emails at most ${MAX_APPROVERS} approvers, so the To line has a sane length`, () => {
      const people = (count: number, length = 30) =>
        Array.from({ length: count }, (_, i) => `${String(i).padStart(length - '@example.com'.length, 'p')}@example.com`);
      const twenty = people(MAX_APPROVERS);
      expect(param(approvalMailOf({ ...live, approverEmails: twenty }), 'emailMessage/To')).toBe(twenty.join(';'));
      expect(MAX_APPROVERS).toBe(20);
      expect(() => buildFlowDefinition({ ...live, approverEmails: people(21) })).toThrow(`${refused}: the approval email can go to at most 20 addresses`);
      expect(() => buildFlowDefinition({ ...live, approverEmails: people(200, 254) })).toThrow('at most 20 addresses, and there are 200');
    });
  });

  describe('web addresses', () => {
    it('uses only the origin and path of the page address, so a query string or fragment cannot reach the five email links', () => {
      const clean = json(live);
      for (const appPageUrl of [
        `${live.appPageUrl}?x=@{triggerBody().EmailSummary}`,
        `${live.appPageUrl}?x=@{triggerBody()?['EmailSummary']}#frag`,
        `${live.appPageUrl}#frag`,
        `${live.appPageUrl}#/admin/request/@{triggerBody()?['Title']}`,
        `${live.appPageUrl}?`,
        'https://CONTOSO.sharepoint.com:443/sites/FormsAndApps/SitePages/Purchase-Requests.aspx?web=1'
      ]) {
        expect(json({ ...live, appPageUrl })).toBe(clean);
      }
      expect(checkFlowConfig({ ...live, appPageUrl: `${live.appPageUrl}?x=1#y` }).appPageUrl).toBe(live.appPageUrl);
      // The links are the page address followed by the app's own route only.
      const links = groupsOf(clean, /href=\\"([^\\"]*)\\"/g).filter((link) => link.startsWith('https://contoso'));
      expect(links.sort()).toEqual([`${live.appPageUrl}#/admin/attention`, `${live.appPageUrl}#/admin/request/@{triggerBody()?['RequestId']}`]);
    });

    it('refuses a page address that is not a plain https address', () => {
      for (const appPageUrl of [
        'http://contoso.sharepoint.com/sites/FormsAndApps/SitePages/Purchase-Requests.aspx',
        'http://127.0.0.1:5173/',
        // A script address, written in two parts so the lint rule against script addresses does not flag the test.
        ['javascript', 'alert(1)'].join(':'),
        '/sites/FormsAndApps/SitePages/Purchase-Requests.aspx',
        'https://contoso.sharepoint.com/sites/{FormsAndApps}/SitePages/Purchase-Requests.aspx',
        "https://contoso.sharepoint.com/sites/O'Brien/SitePages/Purchase-Requests.aspx",
        'https://contoso.sharepoint.com/sites/Forms And Apps/SitePages/Purchase-Requests.aspx',
        'https://contoso.sharepoint.com/sites/a"b/SitePages/Purchase-Requests.aspx',
        'https://contoso.sharepoint.com/sites/a\\b/SitePages/Purchase-Requests.aspx',
        'https://user:secret@contoso.sharepoint.com/sites/FormsAndApps/SitePages/Purchase-Requests.aspx',
        ''
      ]) {
        expect(() => buildFlowDefinition({ ...live, appPageUrl })).toThrow(`${refused}: the address of the Purchase Requests page`);
      }
    });

    it('refuses a site address that is not a plain https address, or that has a query string or fragment', () => {
      for (const siteUrl of [
        'https://contoso.sharepoint.com/sites/{FormsAndApps}',
        "https://contoso.sharepoint.com/sites/@{triggerBody()?['Title']}",
        'https://contoso.sharepoint.com/sites/FormsAndApps?x=1',
        'https://contoso.sharepoint.com/sites/FormsAndApps#x',
        'http://contoso.sharepoint.com/sites/FormsAndApps',
        'https://user:secret@contoso.sharepoint.com/sites/FormsAndApps',
        'https://contoso.sharepoint.com/sites/Forms And Apps',
        "https://contoso.sharepoint.com/sites/O'Brien",
        'https://contoso.sharepoint.com/sites/a<b>',
        'https://contoso.sharepoint.com/sites/a`b',
        'https://contoso.sharepoint.com/sites/a\\b',
        'https://contoso.sharepoint.com/sites/a\u0007b',
        'not an address',
        ''
      ]) {
        expect(() => buildFlowDefinition({ ...live, siteUrl })).toThrow(`${refused}: the site address`);
        // On the test site the destination is the same site, so it is refused too.
        expect(() => buildFlowDefinition({ ...testSite, siteUrl, destinationSiteUrl: siteUrl })).toThrow(refused);
      }
    });

    it('refuses a list ID that is not in the form SharePoint gives it', () => {
      for (const submissionsListId of ["@{triggerBody()?['ID']}", 'list-3', '', '{11111111-2222-3333-4444-555555555555}']) {
        expect(() => buildFlowDefinition({ ...live, submissionsListId })).toThrow(`${refused}: the ID of the Purchase Submissions list`);
      }
    });
  });

  describe('destinations (P-008)', () => {
    it('refuses a live package that would write anywhere but the fixed Accounting folders', () => {
      const elsewhere: Partial<FlowConfig>[] = [
        { destinationSiteUrl: 'https://claruslabsusa.sharepoint.com/sites/Other' },
        { destinationSiteUrl: `${LIVE_DESTINATION.siteUrl}/` },
        { destinationSiteUrl: live.siteUrl },
        { libraryUrlName: 'Documents' },
        { folders: [] },
        { folders: ['01_Company Documents/Accounting/Receipts_To_Process'] },
        { folders: [...LIVE_DESTINATION.folders].reverse() },
        { folders: [...LIVE_DESTINATION.folders, '01_Company Documents/Accounting/Purchases/Purchases_To_Process/2026'] },
        { folders: [...TEST_FOLDERS] }
      ];
      for (const change of elsewhere) {
        expect(() => buildFlowDefinition({ ...live, ...change })).toThrow(`${refused}: a Live package can only send folders to Accounting`);
      }
    });

    it("refuses a test package that would write anywhere but this site's own Purchases_Test folders", () => {
      const elsewhere: Partial<FlowConfig>[] = [
        { folders: [...LIVE_DESTINATION.folders] },
        { folders: [] },
        { folders: ['Purchases_Test'] },
        { destinationSiteUrl: LIVE_DESTINATION.siteUrl },
        { destinationSiteUrl: 'https://contoso.sharepoint.com/sites/Other' },
        { libraryUrlName: LIVE_DESTINATION.libraryUrlName + '/01_Company Documents/Accounting' },
        { libraryUrlName: 'Documents' }
      ];
      for (const change of elsewhere) {
        expect(() => buildFlowDefinition({ ...testSite, ...change })).toThrow(`${refused}: a Test package can only send folders`);
      }
    });

    it('refuses an unknown kind of package', () => {
      expect(() => buildFlowDefinition({ ...live, mode: 'production' as FlowConfig['mode'] })).toThrow(`${refused}: it must be a Test or a Live package.`);
    });
  });
});
