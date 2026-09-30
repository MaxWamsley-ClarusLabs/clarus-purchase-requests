// Checks that the receipt reader's file names in the app (src/reading/assets.ts)
// match the files the SharePoint build adds (config/webpack-patch/receipt-reader.js),
// and that each name carries the installed package's version, so an update to
// the reader never leaves a browser with an old copy (D-074).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { READER_FILES } from '../../src/reading/assets';

const require = createRequire(import.meta.url);

describe('receipt reader files (D-074)', () => {
  it('match the SharePoint build, with the installed versions', () => {
    const table = require('../../config/webpack-patch/receipt-reader.js').RECEIPT_READER_FILES as Record<string, [string, string]>;
    expect(Object.keys(table).sort()).toEqual(Object.values(READER_FILES).sort());
    const version = (pkg: string, from: string) =>
      JSON.parse(readFileSync(require.resolve(`${pkg}/package.json`, { paths: [from] }), 'utf8')).version as string;
    for (const [name, [request, from]] of Object.entries(table)) {
      const pkg = request.startsWith('@') ? request.split('/').slice(0, 2).join('/') : request.split('/')[0];
      // The English data is named by Tesseract itself; its version is in its folder name.
      if (pkg === '@tesseract.js-data/eng') expect(request).toContain('4.0.0_best_int');
      else expect(name).toContain(version(pkg, from));
    }
  });
});
