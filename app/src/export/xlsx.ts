// A minimal Excel workbook writer for the Ledger's download (P-052): one sheet, a bold header row that stays in view, a
// filter on every column, text, numbers, money and clickable links. Built with the zip writer the flow package already
// uses, so no library is added to the app. Text is stored as plain strings, never as formulas, so opening the file can
// never run anything however a purchase was described.

import { ZipEntry, buildZip } from './zip';

/** A cell: text, a number, an amount in dollars, or text that is a link. */
export type XlsxCell = string | number | { dollars: number } | { text: string; url: string } | null;

export interface XlsxSheet {
  name: string;
  header: readonly string[];
  rows: readonly (readonly XlsxCell[])[];
  /** Column widths in characters; a missing one is 14. */
  widths?: readonly number[];
}

// Characters XML does not allow, which would make Excel refuse the file: everything below a space except tab, line
// feed and carriage return, the two non-characters, and lone surrogates.
// eslint-disable-next-line no-control-regex
const NOT_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function escapeXml(text: string): string {
  return text.replace(NOT_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** "A", "B", ... "Z", "AA": the column letters of a zero-based column number. */
export function columnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

// Cell styles: 0 normal, 1 bold header, 2 money, 3 link.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFE6F7"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetXml(sheet: XlsxSheet, links: string[]): string {
  const columns = sheet.header.length;
  const lastRow = sheet.rows.length + 1;
  const range = `A1:${columnName(Math.max(0, columns - 1))}${lastRow}`;
  const text = (ref: string, value: string, style: number) =>
    `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  const rows: string[] = [];
  rows.push(`<row r="1">${sheet.header.map((h, c) => text(`${columnName(c)}1`, h, 1)).join('')}</row>`);
  const hyperlinks: string[] = [];
  sheet.rows.forEach((cells, r) => {
    const rowNumber = r + 2;
    const out = cells.map((cell, c) => {
      const ref = `${columnName(c)}${rowNumber}`;
      if (cell === null || cell === '') return '';
      if (typeof cell === 'string') return text(ref, cell, 0);
      if (typeof cell === 'number') return Number.isFinite(cell) ? `<c r="${ref}"><v>${cell}</v></c>` : '';
      if ('dollars' in cell) return Number.isFinite(cell.dollars) ? `<c r="${ref}" s="2"><v>${cell.dollars}</v></c>` : '';
      links.push(cell.url);
      hyperlinks.push(`<hyperlink ref="${ref}" r:id="rId${links.length}"/>`);
      return text(ref, cell.text, 3);
    });
    rows.push(`<row r="${rowNumber}">${out.join('')}</row>`);
  });
  const cols = sheet.header.map((_, c) => `<col min="${c + 1}" max="${c + 1}" width="${sheet.widths?.[c] ?? 14}" customWidth="1"/>`).join('');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows.join('')}</sheetData>` +
    `<autoFilter ref="${range}"/>` +
    (hyperlinks.length > 0 ? `<hyperlinks>${hyperlinks.join('')}</hyperlinks>` : '') +
    `</worksheet>`
  );
}

/** The name Excel accepts for a sheet: at most 31 characters, none of : \ / ? * [ ]. */
export function sheetName(name: string): string {
  const cleaned = name
    .replace(/[:\\/?*[\]]/g, ' ')
    .trim()
    .slice(0, 31);
  return cleaned === '' ? 'Sheet1' : cleaned;
}

/** The .xlsx file's bytes. */
export function buildXlsx(sheet: XlsxSheet, modified: Date = new Date()): Uint8Array {
  const links: string[] = [];
  const sheetContent = sheetXml(sheet, links);
  const entries: ZipEntry[] = [
    {
      path: '[Content_Types].xml',
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
    },
    {
      path: '_rels/.rels',
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    },
    {
      path: 'xl/workbook.xml',
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${escapeXml(sheetName(sheet.name))}" sheetId="1" r:id="rId1"/></sheets></workbook>`
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
    },
    { path: 'xl/styles.xml', content: STYLES },
    { path: 'xl/worksheets/sheet1.xml', content: sheetContent }
  ];
  if (links.length > 0) {
    entries.push({
      path: 'xl/worksheets/_rels/sheet1.xml.rels',
      content:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        links
          .map(
            (url, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(url)}" TargetMode="External"/>`
          )
          .join('') +
        `</Relationships>`
    });
  }
  return buildZip(entries, modified);
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
