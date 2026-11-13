// Adds the receipt reader's files (D-074) to the app package, next to the
// app's own script. The SharePoint build packs everything webpack writes into
// the app package's ClientSideAssets, so the reader never loads from outside
// sites. The names must match src/reading/assets.ts; a unit test checks this.

'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const tesseractRoot = path.dirname(require.resolve('tesseract.js/package.json', { paths: [projectRoot] }));

/** Name in the app package: [package file, folder to resolve it from]. */
const RECEIPT_READER_FILES = {
  'tesseract-worker-6.0.1.min.js': ['tesseract.js/dist/worker.min.js', projectRoot],
  'tesseract-core-simd-lstm-6.1.2.wasm.js': ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', tesseractRoot],
  'tesseract-core-lstm-6.1.2.wasm.js': ['tesseract.js-core/tesseract-core-lstm.wasm.js', tesseractRoot],
  'eng.traineddata.gz': ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', projectRoot]
};

class ReceiptReaderFilesPlugin {
  apply(compiler) {
    const { Compilation, sources } = compiler.webpack;
    compiler.hooks.thisCompilation.tap('ReceiptReaderFiles', (compilation) => {
      compilation.hooks.processAssets.tap({ name: 'ReceiptReaderFiles', stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, () => {
        for (const [name, [request, from]] of Object.entries(RECEIPT_READER_FILES)) {
          const file = require.resolve(request, { paths: [from] });
          compilation.fileDependencies.add(file);
          // Already minified; "minimized" stops the build minifying them again.
          compilation.emitAsset(name, new sources.RawSource(fs.readFileSync(file)), { minimized: true });
        }
      });
    });
  }
}

function patch(config) {
  config.plugins = [...(config.plugins || []), new ReceiptReaderFilesPlugin()];
  return config;
}

module.exports = patch;
module.exports.RECEIPT_READER_FILES = RECEIPT_READER_FILES;
