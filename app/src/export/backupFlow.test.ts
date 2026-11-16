import {
  BACKUP_FLOW_NAMES,
  BACKUP_FOLDER_NAME,
  BackupFlowConfig,
  buildBackupFlowDefinition,
  buildBackupFlowPackage,
  checkBackupFlowConfig
} from './backupFlow';
import { LIVE_DESTINATION, TEST_FOLDERS } from './flowPackage';
import { LISTS } from '../data/sharepoint/schema';

const live: BackupFlowConfig = {
  mode: 'live',
  siteUrl: 'https://contoso.sharepoint.com/sites/FormsAndApps',
  requestsListId: '11111111-2222-3333-4444-555555555551',
  linesListId: '11111111-2222-3333-4444-555555555552',
  destinationSiteUrl: LIVE_DESTINATION.siteUrl,
  libraryUrlName: LIVE_DESTINATION.libraryUrlName,
  folders: [...LIVE_DESTINATION.folders],
  adminEmail: 'admin@example.com',
  appPageUrl: 'https://contoso.sharepoint.com/sites/FormsAndApps/SitePages/Purchase-Requests.aspx'
};
const testSite: BackupFlowConfig = { ...live, mode: 'test', destinationSiteUrl: live.siteUrl, libraryUrlName: 'Shared Documents', folders: [...TEST_FOLDERS] };

/** Every text matched by the first group (or the second, when the first did not match) of a pattern, in order. */
function matches(source: string, pattern: RegExp): string[] {
  const found: string[] = [];
  for (let m = pattern.exec(source); m !== null; m = pattern.exec(source)) found.push(m[1] ?? m[2]);
  return found;
}

let counter = 0;
const ids = () => `00000000-0000-0000-0000-${String(++counter).padStart(12, '0')}`;

interface Action {
  type: string;
  runAfter: Record<string, string[]>;
  inputs?: {
    host?: { operationId?: string };
    parameters?: Record<string, unknown>;
    from?: string;
    where?: string;
    select?: string;
    format?: string;
    columns?: { header: string; value: string }[];
  };
  actions?: Record<string, Action>;
  else?: { actions: Record<string, Action> };
  runtimeConfiguration?: unknown;
}
interface Definition {
  triggers: Record<string, { type: string; recurrence: Record<string, unknown> }>;
  actions: Record<string, Action>;
}
const build = (config: BackupFlowConfig): Definition => buildBackupFlowDefinition(config) as unknown as Definition;

interface Found {
  name: string;
  action: Action;
  container: Record<string, Action>;
}
function walk(container: Record<string, Action>, found: Found[] = []): Found[] {
  for (const [name, action] of Object.entries(container)) {
    found.push({ name, action, container });
    if (action.actions) walk(action.actions, found);
    if (action.else) walk(action.else.actions, found);
  }
  return found;
}
const operationOf = (a: Action): string | undefined => a.inputs?.host?.operationId;

describe('the nightly ledger backup flow (P-059)', () => {
  const def = build(live);
  const text = JSON.stringify(def);
  const all = walk(def.actions);
  const backup = def.actions.Backup.actions as Record<string, Action>;

  it('runs every night at 02:30 Central time, and nothing else starts it', () => {
    expect(Object.keys(def.triggers)).toEqual(['Every_night']);
    expect(def.triggers.Every_night).toEqual({
      type: 'Recurrence',
      recurrence: { frequency: 'Day', interval: 1, timeZone: 'Central Standard Time', schedule: { hours: ['2'], minutes: [30] } }
    });
  });

  it('reads the two lists, keeps the lines of requests that have been bought, and writes a CSV and a Markdown file', () => {
    expect(Object.keys(backup)).toEqual([
      'Get_bought_requests',
      'Bought_request_ids',
      'Get_all_lines',
      'Ledger_lines',
      'Stamp',
      'Lines_csv',
      'Markdown_rows',
      'Check_backup_folder',
      'If_the_backup_folder_is_missing',
      'Create_csv_file',
      'Create_markdown_file'
    ]);
    expect(backup.Get_bought_requests.inputs?.parameters).toMatchObject({
      dataset: live.siteUrl,
      table: live.requestsListId,
      $filter: "RequestStatus eq 'Submitted' or RequestStatus eq 'Processed'",
      $top: 5000
    });
    expect(backup.Get_all_lines.inputs?.parameters).toMatchObject({ dataset: live.siteUrl, table: live.linesListId, $top: 5000 });
    // Past the first page of 100 items.
    expect(backup.Get_all_lines.runtimeConfiguration).toEqual({ paginationPolicy: { minimumItemCount: 5000 } });
    expect(backup.Ledger_lines.inputs?.where).toBe("@contains(body('Bought_request_ids'), item()?['RequestId'])");
  });

  it('writes only new files, named for the minute, in a Ledger_Backups folder beside Purchases_To_Process: never overwrites, moves or deletes', () => {
    expect(BACKUP_FOLDER_NAME).toBe('Ledger_Backups');
    const folder = '/Shared Documents/01_Company Documents/Accounting/Purchases/Ledger_Backups/';
    expect(backup.Create_csv_file.inputs?.parameters?.folderPath).toBe(folder);
    expect(backup.Create_markdown_file.inputs?.parameters?.folderPath).toBe(folder);
    expect(backup.Create_csv_file.inputs?.parameters?.name).toBe("@{concat('Ledger_', outputs('Stamp'), '.csv')}");
    expect(backup.Create_markdown_file.inputs?.parameters?.name).toBe("@{concat('Ledger_', outputs('Stamp'), '.md')}");
    expect(text).not.toMatch(/overwrite|nameConflictBehavior|DeleteItem|DeleteFile|MoveFile|UpdateFile|recycle|PatchItem|PostItem/i);
    // The only things written are the folder, once, and two new files.
    expect(all.filter((f) => ['CreateFile', 'HttpRequest'].includes(operationOf(f.action) ?? '')).map((f) => f.name)).toEqual([
      'Check_backup_folder',
      'Create_backup_folder',
      'Create_csv_file',
      'Create_markdown_file'
    ]);
    expect(Object.keys(backup.If_the_backup_folder_is_missing.actions as Record<string, Action>)).toEqual(['Create_backup_folder']);
    for (const name of ['Check_backup_folder', 'Create_backup_folder', 'Create_csv_file', 'Create_markdown_file']) {
      const found = all.find((f) => f.name === name)!;
      expect(String(found.action.inputs?.parameters?.dataset)).toBe(live.destinationSiteUrl);
    }
    // The stamp is the only thing in a name that is not fixed text, and it comes from the clock.
    expect(backup.Stamp.inputs).toBe("@formatDateTime(convertTimeZone(utcNow(), 'UTC', 'Central Standard Time'), 'yyyy-MM-dd_HHmm')");
    expect(text).not.toMatch(/triggerBody/);
  });

  it('puts no list text into any address, name or path', () => {
    const paths = all
      .flatMap((f) => [f.action.inputs?.parameters?.folderPath, f.action.inputs?.parameters?.['parameters/uri'], f.action.inputs?.parameters?.name])
      .filter(Boolean)
      .map(String);
    expect(paths.length).toBe(6);
    for (const p of paths) expect(p).not.toMatch(/item\(\)|body\(|triggerBody|variables\(/);
  });

  it('puts the account, class, Posted and who and when in both files, from the list columns', () => {
    const headers = backup.Lines_csv.inputs?.columns?.map((c) => c.header);
    expect(headers).toEqual([
      'Line',
      'Request ID',
      'Row',
      'Date',
      'Vendor',
      'What was bought and why',
      'Category',
      'Other category',
      'Quantity',
      'Amount',
      'Who paid',
      'QuickBooks account',
      'Class',
      'Posted',
      'Posted by',
      'Posted on',
      'No-receipt reason'
    ]);
    const columns = new Set(['ID', ...LISTS.lines.fields.map((f) => f.name), 'Title']);
    const used = matches(text, /item\(\)\?\['(\w+)'\]/g);
    expect(used.filter((name) => !columns.has(name))).toEqual([]);
    for (const name of ['LedgerAccount', 'LedgerClass', 'LedgerPosted', 'LedgerPostedBy', 'LedgerPostedOn']) expect(used).toContain(name);
    expect(String(backup.Markdown_rows.inputs?.select)).toContain('| ');
  });

  it("protects the CSV from text that a spreadsheet would run, as the app's own CSV does", () => {
    const vendor = backup.Lines_csv.inputs?.columns?.find((c) => c.header === 'Vendor')!.value;
    expect(vendor).toContain("startsWith(coalesce(item()?['Vendor'], ''), '=')");
    expect(vendor).toContain("concat('''', coalesce(item()?['Vendor'], ''))");
    // A number or a Y/N the app made is not typed text and is left as it is.
    expect(backup.Lines_csv.inputs?.columns?.find((c) => c.header === 'Posted')!.value).toBe("@if(equals(item()?['LedgerPosted'], true), 'Y', 'N')");
  });

  it('keeps a Markdown table in shape: a pipe is escaped and a line break becomes a space', () => {
    const row = String(backup.Markdown_rows.inputs?.select);
    expect(row).toContain("replace(coalesce(item()?['Vendor'], ''), '|', '\\|')");
    expect(row).toContain("decodeUriComponent('%0A'), ' ')");
  });

  it("emails the administrator if a night's backup fails, and says nothing was changed", () => {
    expect(def.actions.On_backup_failure.runAfter).toEqual({ Backup: ['Failed', 'TimedOut'] });
    const mail = (def.actions.On_backup_failure.actions as Record<string, Action>).Send_backup_failure_email;
    expect(mail.inputs?.parameters?.['emailMessage/To']).toBe('admin@example.com');
    expect(String(mail.inputs?.parameters?.['emailMessage/Body'])).toContain('Nothing in the Ledger or the lists was changed.');
    expect(String(mail.inputs?.parameters?.['emailMessage/Body'])).toContain(`${live.appPageUrl}#/ledger`);
  });

  it('gives every action its own name, and points every runAfter at an action beside it', () => {
    const names = all.map((f) => f.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    const strays = all.filter((f) => Object.keys(f.action.runAfter).some((t) => t === f.name || !(t in f.container)));
    expect(strays.map((f) => f.name)).toEqual([]);
    for (const container of new Set(all.map((f) => f.container))) {
      expect(Object.values(container).some((a) => Object.keys(a.runAfter).length === 0)).toBe(true);
    }
    // No nesting beyond what the Purchase Requests flow already uses.
    expect(all.length).toBe(15);
  });

  it('writes expressions with balanced quotes and brackets', () => {
    const expressions = matches(text, /"(@[^"]*)"|@\{((?:[^{}"]|\\")*)\}/g).map((e) => e.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
    expect(expressions.length).toBeGreaterThan(20);
    const problems: string[] = [];
    for (const e of expressions) {
      let depth = 0;
      let inString = false;
      for (let i = 0; i < e.length; i++) {
        const ch = e[i];
        if (inString) {
          if (ch === "'" && e[i + 1] === "'") i++;
          else if (ch === "'") inString = false;
          continue;
        }
        if (ch === "'") inString = true;
        else if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        if (depth < 0) break;
      }
      if (inString || depth !== 0) problems.push(e);
    }
    expect(problems).toEqual([]);
  });

  it("sends a test run to the test site's own library, and mentions nothing outside the Purchases folders", () => {
    const test = JSON.stringify(build(testSite));
    expect(test).toContain('/Shared Documents/Purchases_Test/Ledger_Backups/');
    expect(test).not.toContain('Accounting');
    expect(test).not.toContain('ExecutiveTeam');
    expect(text).not.toMatch(/Receipts_To_Process|Tax Docs|Payroll|travel/i);
    expect(text).not.toMatch(/Accounting\/(?!Purchases)/);
  });

  it('talks only to the configured sites, the flow run page and the schema', () => {
    const hosts = matches(text, /https?:\/\/([^/'"\\\s]+)/g);
    expect([...new Set(hosts)].sort()).toEqual(
      [new URL(live.siteUrl).host, new URL(live.destinationSiteUrl).host, 'make.powerautomate.com', 'schema.management.azure.com'].sort()
    );
  });
});

describe("the backup flow's import package", () => {
  it('is a package of one flow with the SharePoint and Outlook connections, named for the mode', () => {
    const pkg = buildBackupFlowPackage(live, ids, new Date(Date.UTC(2026, 10, 16)));
    expect(pkg.fileName).toBe('PurchaseRequests_Ledger_Backup_Flow_Live.zip');
    expect(buildBackupFlowPackage(testSite, ids).fileName).toBe('PurchaseRequests_Ledger_Backup_Flow_Test.zip');
    const names = Object.keys(pkg.files);
    expect(names).toHaveLength(5);
    expect(names).toContain('manifest.json');
    expect(names).toContain('Microsoft.Flow/flows/manifest.json');
    for (const part of ['definition', 'apisMap', 'connectionsMap'])
      expect(names.some((n) => n.startsWith('Microsoft.Flow/flows/') && n.endsWith(`/${part}.json`))).toBe(true);
    const manifest = JSON.parse(pkg.files['manifest.json']) as { details: { displayName: string }; resources: Record<string, { type: string }> };
    expect(manifest.details.displayName).toBe(BACKUP_FLOW_NAMES.live);
    expect(Object.values(manifest.resources).filter((r) => r.type === 'Microsoft.Flow/flows')).toHaveLength(1);
    expect(pkg.zip.length).toBeGreaterThan(500);
  });

  it('is not made at all from settings it cannot use safely', () => {
    expect(() => buildBackupFlowPackage({ ...live, requestsListId: 'nope' })).toThrow('Purchase Requests list is not in the form');
    expect(() => buildBackupFlowPackage({ ...live, linesListId: "x'); drop" })).toThrow('Purchase Request Lines list is not in the form');
    expect(() => buildBackupFlowPackage({ ...live, adminEmail: 'a@b.com;evil@x.com' })).toThrow('administrator');
    expect(() => buildBackupFlowPackage({ ...live, mode: 'prod' as never })).toThrow('Test or a Live');
    expect(() =>
      buildBackupFlowPackage({ ...live, folders: ['01_Company Documents/Accounting/Payroll stuff', '01_Company Documents/Accounting/Payroll stuff/x'] })
    ).toThrow('Live package can only');
    expect(() => buildBackupFlowPackage({ ...live, destinationSiteUrl: 'https://evil.example.com/sites/x' })).toThrow('Live package can only');
    expect(() => buildBackupFlowPackage({ ...testSite, folders: ['Elsewhere', 'Elsewhere/x'] })).toThrow('Test package can only');
    expect(() => buildBackupFlowPackage({ ...live, appPageUrl: 'http://contoso.sharepoint.com/page.aspx' })).toThrow('https');
  });

  it('keeps only the origin and path of the page address', () => {
    expect(checkBackupFlowConfig({ ...live, appPageUrl: `${live.appPageUrl}?x=@{evil()}#/x` }).appPageUrl).toBe(live.appPageUrl);
  });
});
