// Checks a generated flow package with flow/tools/check_package.py (written
// during the Stage 0 import research), and keeps flow/example/definition.json
// current: an example definition with made-up IDs, for review in the
// repository ("npm run flow-example" rewrites it).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlowConfig, LIVE_DESTINATION, buildFlowPackage } from '../../src/export/flowPackage';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const EXAMPLE = join(REPO, 'flow/example/definition.json');

const example: FlowConfig = {
  mode: 'live',
  travelSiteUrl: 'https://contoso.sharepoint.com/sites/Travel',
  submissionsListId: '00000000-0000-0000-0000-000000000003',
  destinationSiteUrl: LIVE_DESTINATION.siteUrl,
  libraryUrlName: LIVE_DESTINATION.libraryUrlName,
  folders: [...LIVE_DESTINATION.folders],
  adminEmail: 'administrator@example.com',
  appPageUrl: 'https://contoso.sharepoint.com/sites/Travel/SitePages/Travel-Expenses.aspx'
};

let n = 0;
const ids = () => `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`;

describe('flow package', () => {
  const pkg = buildFlowPackage(example, ids, new Date(Date.UTC(2026, 8, 24, 12, 0, 0)));

  it('passes the package checker', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'flow-')), pkg.fileName);
    writeFileSync(file, pkg.zip);
    const out = execFileSync('python3', [join(REPO, 'flow/tools/check_package.py'), file], { encoding: 'utf8' });
    expect(out.trim()).toBe('OK');
  });

  it('matches flow/example/definition.json', () => {
    const definitionPath = Object.keys(pkg.files).find((p) => p.endsWith('/definition.json'))!;
    const expected = pkg.files[definitionPath] + '\n';
    if (process.env.UPDATE_FLOW_EXAMPLE === '1') {
      writeFileSync(EXAMPLE, expected);
      return;
    }
    expect(readFileSync(EXAMPLE, 'utf8')).toBe(expected);
  });
});
