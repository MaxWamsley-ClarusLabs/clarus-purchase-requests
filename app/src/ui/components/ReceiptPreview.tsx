import * as React from 'react';
import { canPreview, quoteFiles, receiptFiles, receiptSourceRow } from '../../domain/receipts';
import { AttachedFile, PurchaseLine } from '../../domain/types';
import { useApp } from '../AppContext';
import { useDialogFocus } from '../hooks';
import { Card } from './common';
import { Icon } from './Icon';

/** A file to show, and the row that holds it (which is how the data service finds it). */
interface PreviewFile {
  file: AttachedFile;
  ownerLineId: string;
}

/**
 * Loads a file through the data service. In SharePoint the file is fetched by
 * the app and shown from memory, so the site's download settings cannot block
 * the preview. The memory copy is released when no longer shown.
 */
function useFileUrl(lineId: string, file: AttachedFile | undefined): { url: string; failed: boolean } {
  const app = useApp();
  const [state, setState] = React.useState<{ key: string; url: string; failed: boolean }>({ key: '', url: '', failed: false });
  const key = file ? `${lineId}/${file.id}` : '';
  React.useEffect(() => {
    if (!file) return;
    let alive = true;
    let url = '';
    app.service
      .filePreviewUrl(lineId, file)
      .then((u) => {
        url = u;
        // An empty address means this file cannot be shown (for example a preview file that no longer exists).
        if (alive) setState({ key, url: u, failed: u === '' });
        else if (u.startsWith('blob:')) URL.revokeObjectURL(u);
      })
      .catch(() => {
        if (alive) setState({ key, url: '', failed: true });
      });
    return () => {
      alive = false;
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [key]);
  return state.key === key ? state : { url: '', failed: false };
}

/**
 * The files of a row: its receipts and invoices (or the receipt it shares),
 * then its quotes, which are never shared (P-021).
 */
function filesOf(line: PurchaseLine | undefined, lines: readonly PurchaseLine[]): PreviewFile[] {
  if (!line) return [];
  const source = receiptSourceRow(line, lines);
  const receipts = source ? receiptFiles(source).map((file) => ({ file, ownerLineId: source.id })) : [];
  const quotes = quoteFiles(line).map((file) => ({ file, ownerLineId: line.id }));
  return [...receipts, ...quotes];
}

/** Shows the selected row's files beside the grid (travel D-033), one tab for each file. */
export function ReceiptPreview(props: {
  line: PurchaseLine | undefined;
  lines: PurchaseLine[];
  /** The file to show first, when the employee clicked one in the grid. */
  focusFileId?: string;
  onHide: () => void;
  overlay?: boolean;
}): React.ReactElement {
  const { line, lines } = props;
  const files = filesOf(line, lines);
  const [index, setIndex] = React.useState(0);
  const fileKey = files.map((f) => f.file.id).join('|');
  React.useEffect(() => {
    const at = props.focusFileId ? files.findIndex((f) => f.file.id === props.focusFileId) : -1;
    setIndex(at >= 0 ? at : 0);
  }, [line?.id, props.focusFileId, fileKey]);
  const current = files[Math.min(index, files.length - 1)];
  const kind = current ? canPreview(current.file.fileName) : 'none';
  const loaded = useFileUrl(current ? current.ownerLineId : '', kind === 'none' ? undefined : current?.file);

  let caption = 'Select a row to see its files.';
  if (line) {
    const source = receiptSourceRow(line, lines);
    if (line.sameReceiptAsRow !== null && source) caption = `Row ${line.rowNumber} uses the receipt on row ${source.rowNumber}.`;
    else if (files.length === 0) {
      const reasons = [line.noReceiptReason && `no receipt: ${line.noReceiptReason}`, line.noQuoteReason && `no quote: ${line.noQuoteReason}`].filter(Boolean);
      caption = reasons.length > 0 ? `Row ${line.rowNumber} has ${reasons.join(', ')}` : `Row ${line.rowNumber} has no files yet.`;
    } else caption = `Row ${line.rowNumber}${line.vendor ? `: ${line.vendor}` : ''}`;
  }

  // Over the page, the panel takes the keyboard like a dialog: Escape closes it, and focus returns to the file clicked.
  const ref = React.useRef<HTMLDivElement>(null);
  useDialogFocus(ref, props.onHide, !!props.overlay);

  const label = current && current.file.kind === 'quote' ? 'Quote' : 'Receipt';
  const panel = (
    <div
      ref={ref}
      className={props.overlay ? 'ctx-preview-overlay' : 'ctx-preview'}
      role={props.overlay ? 'dialog' : undefined}
      aria-modal={props.overlay ? true : undefined}
      aria-label={props.overlay ? 'Files' : undefined}
      tabIndex={props.overlay ? -1 : undefined}
    >
      <Card
        title="Files"
        actions={
          <button className="ctx-btn ctx-btn-ghost ctx-btn-small" onClick={props.onHide}>
            <Icon name={props.overlay ? 'x' : 'eye'} size={15} />
            {props.overlay ? 'Close' : 'Hide'}
          </button>
        }
      >
        <div className="ctx-hint" style={{ marginBottom: 8 }}>
          {caption}
        </div>
        <div className="ctx-preview-frame">
          {current && loaded.url && kind === 'image' ? <img src={loaded.url} alt={`${label} ${current.file.fileName}`} /> : null}
          {current && loaded.url && kind === 'pdf' ? <iframe src={loaded.url} title={`${label} ${current.file.fileName}`} /> : null}
          {current && kind !== 'none' && !loaded.url ? (
            <div className="ctx-empty">
              <Icon name="file" size={28} />
              <div>{loaded.failed ? `${current.file.fileName} could not be loaded. Close and open it again.` : 'Loading'}</div>
            </div>
          ) : null}
          {current && kind === 'none' ? (
            <div className="ctx-empty">
              <Icon name="file" size={28} />
              <div>{current.file.fileName}</div>
              <div className="ctx-hint">This file type cannot be previewed in the browser. It is kept as uploaded.</div>
            </div>
          ) : null}
          {!current ? (
            <div className="ctx-empty">
              <Icon name="file" size={28} />
            </div>
          ) : null}
        </div>
        {files.length > 1 || files.some((f) => f.file.kind === 'quote') ? (
          <div className="ctx-preview-files" role="tablist" aria-label="Files of this row">
            {files.map((f, i) => (
              <button
                key={f.file.id}
                role="tab"
                aria-selected={i === index}
                className={`ctx-preview-file ${i === index ? 'active' : ''}`}
                onClick={() => setIndex(i)}
              >
                <Icon name="file" size={14} />
                {f.file.kind === 'quote' ? <strong>Quote</strong> : null}
                <span>{f.file.fileName}</span>
              </button>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
  return props.overlay ? (
    <>
      <div className="ctx-backdrop" onClick={props.onHide} />
      {panel}
    </>
  ) : (
    panel
  );
}
