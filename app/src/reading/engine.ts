// The receipt reader itself (D-074): the Tesseract text reader, running in a
// background worker in the employee's browser, and PDF.js for PDFs. This file
// is loaded only when a receipt is first read, as its own script, so the app
// opens as fast as before. Nothing here leaves the browser.
//
// Settings measured in docs/research/receipt-reading/README.md:
// - a PDF with a text layer is read directly; a scanned PDF is drawn as an image;
// - an image read with confidence under 60, or without a total or date, is
//   read again after clean-up (larger, grey, smoothed, black and white);
// - below 45 the text is too unclear to trust, and nothing is suggested.

import { createWorker, Worker as TextWorker } from 'tesseract.js';
import { getDocument } from 'pdfjs-dist';
// Loads PDF.js's worker code into this script, so PDF.js runs here rather than
// fetching a second worker file.
import 'pdfjs-dist/build/pdf.worker.mjs';
import { simd } from 'wasm-feature-detect';
import { canPreview } from '../domain/receipts';
import { EMPTY_GUESS, guessReceiptFields, ReceiptGuess } from '../domain/receiptText';
import { ReaderAssets } from './assets';
import { hasTextLayer, PdfTextPiece, pdfTextLines } from './pdfLines';

const RETRY_BELOW_CONFIDENCE = 60;
export const MIN_CONFIDENCE = 45;
/** Larger photos are scaled down first: reading time grows with size, accuracy does not. */
const MAX_IMAGE_SIDE = 3200;
/** Scanned PDF pages are drawn at this scale (about 180 dots per inch). */
const PDF_SCALE = 2.5;

let workerPromise: Promise<TextWorker> | undefined;

async function textWorker(assets: ReaderAssets): Promise<TextWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng', 1, {
        workerPath: assets.workerUrl,
        corePath: (await simd()) ? assets.coreSimdUrl : assets.coreUrl,
        langPath: assets.languageFolderUrl,
        gzip: true,
        // Kept by the browser after the first download.
        cacheMethod: 'write',
        // Failures come back through the promise; without this the reader also raises a page error.
        errorHandler: () => undefined
      });
      // Keeps the reader's own notes ("Line cannot be recognized") out of the browser console.
      await worker.setParameters({ debug_file: '/dev/null' });
      return worker;
    })();
    workerPromise.catch(() => {
      workerPromise = undefined;
    });
  }
  return workerPromise;
}

function canvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('Canvas is not available.');
  return g;
}

/** Draws an image file, turned the right way up (phone photos record their rotation). */
async function imageToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const c = canvas(bitmap.width * k, bitmap.height * k);
  context(c).drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return c;
}

/** Second attempt for poor images: larger, grey, speckle smoothed out, then black and white (Otsu's threshold). */
function cleanUp(src: HTMLCanvasElement): HTMLCanvasElement {
  const k = src.width < 1200 ? 2 : 1;
  const c = canvas(src.width * k, src.height * k);
  const g = context(c);
  g.filter = `grayscale(1) blur(${1.2 * k}px)`;
  g.drawImage(src, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height);
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < d.data.length; i += 4) hist[d.data[i]]++;
  const total = c.width * c.height;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  for (let i = 0; i < d.data.length; i += 4) {
    const v = d.data[i] > threshold ? 255 : 0;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
  }
  g.putImageData(d, 0, 0);
  return c;
}

async function readImage(image: HTMLCanvasElement, assets: ReaderAssets): Promise<ReceiptGuess> {
  const worker = await textWorker(assets);
  const first = (await worker.recognize(image)).data;
  let lines = first.text.split('\n');
  let confidence = first.confidence;
  const guess = guessReceiptFields(lines);
  if (confidence < RETRY_BELOW_CONFIDENCE || guess.amountCents === null || !guess.date) {
    const second = (await worker.recognize(cleanUp(image))).data;
    if (second.confidence > confidence) {
      lines = second.text.split('\n');
      confidence = second.confidence;
    }
  }
  // Too unclear to trust: suggest nothing, so the employee types the details.
  return confidence < MIN_CONFIDENCE ? EMPTY_GUESS : guessReceiptFields(lines);
}

async function readPdf(file: Blob, assets: ReaderAssets): Promise<ReceiptGuess> {
  const data = new Uint8Array(await file.arrayBuffer());
  // No scripts, fonts or other files are loaded for the PDF.
  const doc = await getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  try {
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const lines = pdfTextLines(content.items.filter((i): i is PdfTextPiece & typeof i => 'str' in i));
    if (hasTextLayer(lines)) return guessReceiptFields(lines);
    // A scanned PDF: draw the first page and read it as an image.
    const viewport = page.getViewport({ scale: PDF_SCALE });
    const c = canvas(viewport.width, viewport.height);
    await page.render({ canvasContext: context(c), viewport }).promise;
    return readImage(c, assets);
  } finally {
    await doc.destroy();
  }
}

/** Reads one receipt. Throws if the reader cannot start in this browser. */
export async function readReceipt(file: Blob, fileName: string, assets: ReaderAssets): Promise<ReceiptGuess> {
  const kind = canPreview(fileName);
  if (kind === 'pdf') return readPdf(file, assets);
  // HEIC photos cannot be opened by most browsers; the employee types those.
  if (kind === 'image') return readImage(await imageToCanvas(file), assets);
  return EMPTY_GUESS;
}

/** Starts the reader ahead of the first receipt, so a problem shows at once. */
export async function startReader(assets: ReaderAssets): Promise<void> {
  await textWorker(assets);
}
