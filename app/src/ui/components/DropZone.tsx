import * as React from 'react';
import { ACCEPT_ATTRIBUTE } from '../../domain/receipts';
import { Icon } from './Icon';

/** The receipt drop box (D-033): drop files or choose them. Each file becomes a row. */
export function DropZone(props: { onFiles: (files: File[]) => void; disabled?: boolean }): React.ReactElement {
  const [over, setOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
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
        if (!props.disabled) props.onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="ctx-drop-icon">
        <Icon name="upload" size={22} />
      </div>
      <div style={{ flex: 1 }}>
        <div className="ctx-drop-title">Drop all your receipts here</div>
        <div className="ctx-hint">Each receipt becomes a row. PDF, JPG, PNG or HEIC, up to 15 MB each.</div>
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
          if (files.length) props.onFiles(files);
        }}
      />
    </div>
  );
}
