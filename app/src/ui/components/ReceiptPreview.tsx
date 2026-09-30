import * as React from 'react';
import { canPreview, receiptSourceRow } from '../../domain/receipts';
import { ExpenseLine } from '../../domain/types';
import { useApp } from '../AppContext';
import { Card } from './common';
import { Icon } from './Icon';

/**
 * Loads a receipt through the data service. In SharePoint the file is fetched
 * by the app and shown from memory, so the site's download settings cannot
 * block the preview. The memory copy is released when no longer shown.
 */
function useReceiptUrl(lineId: string, receipt: ExpenseLine['receipts'][number] | undefined): { url: string; failed: boolean } {
  const app = useApp();
  const [state, setState] = React.useState<{ key: string; url: string; failed: boolean }>({ key: '', url: '', failed: false });
  const key = receipt ? `${lineId}/${receipt.id}` : '';
  React.useEffect(() => {
    if (!receipt) return;
    let alive = true;
    let url = '';
    app.service
      .receiptPreviewUrl(lineId, receipt)
      .then((u) => {
        url = u;
        if (alive) setState({ key, url: u, failed: false });
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

/** Shows the selected row's receipt beside the grid (D-033). */
export function ReceiptPreview(props: { line: ExpenseLine | undefined; lines: ExpenseLine[]; onHide: () => void; overlay?: boolean }): React.ReactElement {
  const { line, lines } = props;
  const source = line ? receiptSourceRow(line, lines) : undefined;
  const files = source ? source.receipts : [];
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => setIndex(0), [line?.id]);
  const current = files[Math.min(index, files.length - 1)];
  const kind = current ? canPreview(current.fileName) : 'none';
  const loaded = useReceiptUrl(source ? source.id : '', kind === 'none' ? undefined : current);

  let caption = 'Select a row to see its receipt.';
  if (line) {
    if (line.sameReceiptAsRow !== null && source) caption = `Row ${line.rowNumber} uses the receipt on row ${source.rowNumber}.`;
    else if (files.length === 0)
      caption = line.noReceiptReason ? `Row ${line.rowNumber} has no receipt: ${line.noReceiptReason}` : `Row ${line.rowNumber} has no receipt yet.`;
    else caption = `Row ${line.rowNumber}${line.vendor ? `: ${line.vendor}` : ''}`;
  }

  React.useEffect(() => {
    if (!props.overlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onHide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.overlay, props.onHide]);

  const panel = (
    <div
      className={props.overlay ? 'ctx-preview-overlay' : 'ctx-preview'}
      role={props.overlay ? 'dialog' : undefined}
      aria-label={props.overlay ? 'Receipt' : undefined}
    >
      <Card
        title="Receipt"
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
          {current && loaded.url && kind === 'image' ? <img src={loaded.url} alt={`Receipt ${current.fileName}`} /> : null}
          {current && loaded.url && kind === 'pdf' ? <iframe src={loaded.url} title={`Receipt ${current.fileName}`} /> : null}
          {current && kind !== 'none' && !loaded.url ? (
            <div className="ctx-empty">
              <Icon name="file" size={28} />
              <div>{loaded.failed ? `${current.fileName} could not be loaded. Close and open it again.` : 'Loading'}</div>
            </div>
          ) : null}
          {current && kind === 'none' ? (
            <div className="ctx-empty">
              <Icon name="file" size={28} />
              <div>{current.fileName}</div>
              <div className="ctx-hint">This file type cannot be previewed in the browser. It is kept as uploaded.</div>
            </div>
          ) : null}
          {!current ? (
            <div className="ctx-empty">
              <Icon name="file" size={28} />
            </div>
          ) : null}
        </div>
        {files.length > 1 ? (
          <div className="ctx-preview-files">
            {files.map((f, i) => (
              <button key={f.id} className={`ctx-preview-file ${i === index ? 'active' : ''}`} onClick={() => setIndex(i)}>
                <Icon name="file" size={14} />
                {f.fileName}
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
