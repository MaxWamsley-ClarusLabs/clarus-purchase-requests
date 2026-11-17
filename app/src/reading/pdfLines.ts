// Rebuilds printed lines from a PDF's text layer (D-074). A PDF stores text as
// pieces placed on the page; pieces at the same height form one line, read
// left to right, and lines run top to bottom.

export interface PdfTextPiece {
  str: string;
  /** PDF.js's transform: [4] is the left edge, [5] the baseline height (up is larger). */
  transform: number[];
}

/** Pieces whose baselines are this close (in PDF points) are on the same line. */
const SAME_LINE_POINTS = 3;

export function pdfTextLines(pieces: readonly PdfTextPiece[]): string[] {
  const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
  for (const piece of pieces) {
    if (!piece.str.trim()) continue;
    const y = piece.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < SAME_LINE_POINTS);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: piece.transform[4], s: piece.str });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.s)
        .join(' ')
    );
}

/** Whether a PDF's text layer holds enough to read, rather than being a scanned image. */
export function hasTextLayer(lines: readonly string[]): boolean {
  return lines.join('').replace(/\s/g, '').length >= 20;
}
