import * as React from 'react';
import { QUOTE_THRESHOLD_TEXT } from '../../domain/purchaseRules';
import { ACCEPT_ATTRIBUTE } from '../../domain/receipts';
import { FileKind } from '../../domain/types';
import { Icon } from './Icon';

const KINDS: { kind: FileKind; label: string }[] = [
  { kind: 'receipt', label: 'Receipts or invoices' },
  { kind: 'quote', label: 'Quotes' }
];

/**
 * The drop box (travel D-033): drop files or choose them. Each file becomes a
 * row. The switch says whether the files are receipts or invoices (the
 * default) or quotes (P-021). `quoteHint` adds a reminder that a vendor total
 * of $500 or more needs a quote.
 */
export function DropZone(props: { onFiles: (files: File[], kind: FileKind) => void; disabled?: boolean; quoteHint?: boolean }): React.ReactElement {
  const [over, setOver] = React.useState(false);
  const [kind, setKind] = React.useState<FileKind>('receipt');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const switchRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  // Arrow keys move between the two choices, as in any radio group.
  const onSwitchKey = (e: React.KeyboardEvent) => {
    const move = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (move === 0) return;
    e.preventDefault();
    const next = KINDS[(KINDS.findIndex((k) => k.kind === kind) + move + KINDS.length) % KINDS.length];
    setKind(next.kind);
    switchRefs.current[next.kind]?.focus();
  };

  return (
    <div
      className={`ctx-drop ${over ? 'over' : ''}`}
      onDragOver={(e) => {
        if (props.disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!props.disabled) props.onFiles(Array.from(e.dataTransfer.files), kind);
      }}
    >
      <div className="ctx-drop-icon">
        <Icon name="upload" size={22} />
      </div>
      <div style={{ flex: 1 }}>
        <div className="ctx-drop-title">Drop receipts, invoices or quotes here</div>
        <div className="ctx-hint">Each file becomes a row. PDF, JPG, PNG or HEIC, up to 15 MB each.</div>
        <div className="ctx-drop-kind">
          <span className="ctx-hint">These files are</span>
          <div className="ctx-segmented" role="radiogroup" aria-label="These files are" onKeyDown={onSwitchKey}>
            {KINDS.map((k) => (
              <button
                key={k.kind}
                ref={(el) => {
                  switchRefs.current[k.kind] = el;
                }}
                role="radio"
                aria-checked={kind === k.kind}
                tabIndex={kind === k.kind ? 0 : -1}
                onClick={() => setKind(k.kind)}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
        {props.quoteHint ? (
          <div className="ctx-hint ctx-drop-note">A vendor total of {QUOTE_THRESHOLD_TEXT} or more needs a quote. Choose Quotes for a quote.</div>
        ) : null}
      </div>
      <button className="ctx-btn ctx-btn-secondary" disabled={props.disabled} onClick={() => inputRef.current?.click()}>
        Choose files
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) props.onFiles(files, kind);
        }}
      />
    </div>
  );
}
