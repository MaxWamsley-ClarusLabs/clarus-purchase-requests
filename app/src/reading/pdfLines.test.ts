import { hasTextLayer, pdfTextLines } from './pdfLines';

const piece = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });

describe('lines from a PDF text layer (D-074)', () => {
  it('joins pieces on the same line left to right, and orders lines top to bottom', () => {
    const lines = pdfTextLines([piece('$452.30', 400, 500), piece('Total', 50, 501.5), piece('SKYWAY AIRLINES', 50, 760), piece(' ', 10, 300)]);
    expect(lines).toEqual(['SKYWAY AIRLINES', 'Total $452.30']);
  });

  it('treats a page with almost no text as scanned', () => {
    expect(hasTextLayer(['Scan 1'])).toBe(false);
    expect(hasTextLayer(['Harbor View Hotel', 'Total 654.34'])).toBe(true);
  });
});
