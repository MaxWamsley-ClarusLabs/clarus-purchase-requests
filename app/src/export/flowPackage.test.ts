import {
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
import { crc32 } from './zip';

const live: FlowConfig = {
  mode: 'live',
  travelSiteUrl: 'https://contoso.sharepoint.com/sites/Travel',
  submissionsListId: '11111111-2222-3333-4444-555555555555',
  destinationSiteUrl: LIVE_DESTINATION.siteUrl,
  libraryUrlName: LIVE_DESTINATION.libraryUrlName,
  folders: [...LIVE_DESTINATION.folders],
  adminEmail: 'admin@example.com',
  appPageUrl: 'https://contoso.sharepoint.com/sites/Travel/SitePages/Travel-Expenses.aspx'
};

let counter = 0;
const ids = () => `00000000-0000-0000-0000-${String(++counter).padStart(12, '0')}`;

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

  it('escapes stored text before it goes into the email (D-067)', () => {
    const e = htmlTextExpression("triggerBody()?['EmailSummary']");
    // "&" first, so the entities that follow are not escaped twice.
    expect(e.indexOf("'&amp;'")).toBeLessThan(e.indexOf("'&lt;'"));
    expect(e).toContain("'<', '&lt;'");
    expect(e).toContain("'\"', '&quot;'");
    expect(e).toContain("decodeUriComponent('%0A'), '<br>')");
  });
});

describe('the packaging flow (strategy section 7)', () => {
  const definition = buildFlowDefinition(live) as {
    triggers: Record<string, { conditions: { expression: string }[]; inputs: { parameters: Record<string, string> }; runtimeConfiguration: unknown }>;
    actions: Record<string, { actions: Record<string, unknown> }>;
  };
  const text = JSON.stringify(definition);

  it('starts only for submissions marked Ready, one at a time', () => {
    const trigger = definition.triggers.When_a_submission_is_ready;
    expect(trigger.conditions[0].expression).toBe("@equals(triggerBody()?['PackageStatus']?['Value'], 'Ready')");
    expect(trigger.inputs.parameters).toEqual({ dataset: live.travelSiteUrl, table: live.submissionsListId });
    expect(trigger.runtimeConfiguration).toEqual({ concurrency: { runs: 1 } });
  });

  it('claims the submission before copying anything', () => {
    expect(Object.keys(definition.actions)).toEqual(['Claim_the_submission', 'Package', 'On_failure']);
    expect(text).toContain('"item/PackageStatus/Value":"Processing"');
  });

  it('uses a fixed destination inside Trips_To_Process, never a value from the list', () => {
    expect(text).toContain("/sites/ExecutiveTeam/Shared Documents/01_Company Documents/Accounting/Trips/Trips_To_Process/'");
    expect(text).toContain("'/Shared Documents/01_Company Documents/Accounting/Trips/Trips_To_Process/'");
    // The only list value in any path is the cleaned folder name.
    expect(text).not.toMatch(/folderPath":"@\{concat\([^)]*triggerBody/);
    expect(text).toContain("outputs('Safe_folder_name')");
  });

  it('creates Trips and Trips_To_Process only if missing, and never year folders', () => {
    const pkg = definition.actions.Package.actions;
    expect(Object.keys(pkg).filter((k) => k.startsWith('If_folder_'))).toEqual(['If_folder_1_is_missing', 'If_folder_2_is_missing']);
    expect(text).not.toMatch(/Trips\/20\d\d/);
  });

  it('never overwrites: stops if the report folder exists, and marks the submission Failed', () => {
    expect(text).toContain('A folder with this name already exists in Trips_To_Process, so nothing was copied or overwritten.');
    expect(text).not.toMatch(/overwrite=true|nameConflictBehavior/i);
    expect(text).not.toMatch(/DeleteItem|DeleteFile|MoveFile|recycle/);
  });

  it('marks failures and emails the administrator', () => {
    const onFailure = definition.actions.On_failure as unknown as { runAfter: unknown; actions: Record<string, unknown> };
    expect(onFailure.runAfter).toEqual({ Package: ['Failed', 'TimedOut'] });
    expect(Object.keys(onFailure.actions)).toEqual(['Failed_steps', 'Mark_failed', 'Send_failure_email']);
    expect(text).toContain('"emailMessage/To":"admin@example.com"');
  });

  it('can send test runs to the test site instead of Accounting', () => {
    const test = JSON.stringify(
      buildFlowDefinition({ ...live, mode: 'test', destinationSiteUrl: live.travelSiteUrl, libraryUrlName: 'Shared Documents', folders: TEST_FOLDERS })
    );
    expect(test).toContain('/sites/Travel/Shared Documents/Trips_Test/Trips_To_Process');
    expect(test).not.toContain('Accounting');
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
    expect(Object.keys(definition.properties.connectionReferences)).toEqual(['shared_sharepointonline', 'shared_office365']);
    const manifest = JSON.parse(pkg.files['manifest.json']);
    expect(manifest.resources[flowId].dependsOn).toHaveLength(4);
    expect(pkg.fileName).toBe('PurchaseRequests_Flow_Live.zip');
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
