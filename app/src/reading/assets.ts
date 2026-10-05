// The receipt reader's files (D-074). They ship inside the app package, next
// to the app's own script, so the app loads nothing from outside sites. The
// SharePoint build adds them under these names
// (config/webpack-patch/receipt-reader.js); the local preview serves them from
// node_modules. The version in each name means a browser never keeps an old
// copy after an update. A unit test checks that these names match the build.

export const READER_FILES = {
  worker: 'tesseract-worker-6.0.1.min.js',
  /** For browsers with WebAssembly SIMD (current Edge, Chrome, Safari, Firefox). */
  coreSimd: 'tesseract-core-simd-lstm-6.1.2.wasm.js',
  core: 'tesseract-core-lstm-6.1.2.wasm.js',
  /** English text data. The reader asks for it by this exact name. */
  english: 'eng.traineddata.gz'
} as const;

/** Where the browser can load each reader file from. */
export interface ReaderAssets {
  workerUrl: string;
  coreSimdUrl: string;
  coreUrl: string;
  /** The folder holding eng.traineddata.gz, without a trailing slash. */
  languageFolderUrl: string;
}

/** The reader files in one folder, such as the folder the app's script came from. */
export function readerAssetsIn(folderUrl: string): ReaderAssets {
  const folder = folderUrl.replace(/\/+$/, '');
  return {
    workerUrl: `${folder}/${READER_FILES.worker}`,
    coreSimdUrl: `${folder}/${READER_FILES.coreSimd}`,
    coreUrl: `${folder}/${READER_FILES.core}`,
    languageFolderUrl: folder
  };
}
