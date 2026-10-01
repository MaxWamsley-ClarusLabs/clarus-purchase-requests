import * as React from 'react';
import { BadgeTone } from '../../domain/statuses';
import { formatCents } from '../../domain/money';
import { Totals } from '../../domain/totals';
import { AttachedFile } from '../../domain/types';
import { useDialogFocus } from '../hooks';
import { Icon } from './Icon';

export function Badge(props: { tone: BadgeTone; children: React.ReactNode }): React.ReactElement {
  return <span className={`ctx-badge ${props.tone}`}>{props.children}</span>;
}

/** A small label next to a value, for example "Bought before approval" (P-017). */
export function Tag(props: { tone?: 'amber' | 'lavender'; title?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <span className={`ctx-tag ${props.tone ?? 'amber'}`} title={props.title}>
      {props.children}
    </span>
  );
}

export function HeaderCard(props: { title: string; subtitle?: React.ReactNode; badges?: React.ReactNode; actions?: React.ReactNode }): React.ReactElement {
  return (
    <header className="ctx-header">
      <div>
        <h1 className="ctx-page-title">{props.title}</h1>
        {props.subtitle ? <div className="ctx-page-subtitle">{props.subtitle}</div> : null}
      </div>
      <div className="ctx-header-actions">
        {props.badges}
        {props.actions}
      </div>
    </header>
  );
}

export function Card(props: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }): React.ReactElement {
  return (
    <section className={`ctx-card ${props.className ?? ''}`}>
      {props.title || props.actions ? (
        <div className="ctx-card-head">
          {props.title ? <h2 className="ctx-card-title">{props.title}</h2> : <span />}
          {props.actions ? <div className="ctx-row-flex">{props.actions}</div> : null}
        </div>
      ) : null}
      {props.children}
    </section>
  );
}

export interface StatusMetric {
  label: string;
  value: React.ReactNode;
  note: string;
}

/**
 * Totals under the header on every step (travel D-033, P-011). The fourth card
 * shows what needs attention; a brand-new request shows "To fill in" rather
 * than red, and a locked request shows its status instead. `approvalNote` is
 * the approval state's label when it is worth showing (needed, pending or
 * changed since approval).
 */
export function TotalsStrip(props: {
  totals: Totals;
  blockingCount: number;
  warningCount: number;
  fresh?: boolean;
  status?: StatusMetric;
  approvalNote?: string;
}): React.ReactElement {
  const { totals, blockingCount, warningCount } = props;
  const attention = blockingCount > 0 && !props.fresh;
  const warningText = warningCount === 1 ? '1 warning to check' : `${warningCount} warnings to check`;
  const attentionNote = props.approvalNote ? (warningCount > 0 ? `${props.approvalNote}. ${warningText}` : props.approvalNote) : warningText;
  return (
    <div className="ctx-totals" aria-label="Totals">
      <div className="ctx-metric">
        <div className="ctx-metric-label">To reimburse</div>
        <div className="ctx-metric-value">{formatCents(totals.reimburseCents)}</div>
        <div className="ctx-metric-note">Paid by the employee</div>
      </div>
      <div className="ctx-metric">
        <div className="ctx-metric-label">Paid by Clarus</div>
        <div className="ctx-metric-value">{formatCents(totals.companyCents)}</div>
        <div className="ctx-metric-note">Company card or invoice</div>
      </div>
      <div className="ctx-metric">
        <div className="ctx-metric-label">Request total</div>
        <div className="ctx-metric-value">{formatCents(totals.requestCents)}</div>
        <div className="ctx-metric-note">All purchases</div>
      </div>
      {props.status ? (
        <div className="ctx-metric">
          <div className="ctx-metric-label">{props.status.label}</div>
          <div className="ctx-metric-value" style={{ fontSize: '1rem' }}>
            {props.status.value}
          </div>
          <div className="ctx-metric-note">{props.status.note}</div>
        </div>
      ) : props.fresh ? (
        <div className="ctx-metric">
          <div className="ctx-metric-label">Needs attention</div>
          <div className="ctx-metric-value">To fill in</div>
          <div className="ctx-metric-note">Start with the request details</div>
        </div>
      ) : (
        <div className={`ctx-metric ${attention ? 'attention' : 'clear'}`}>
          <div className="ctx-metric-label">Needs attention</div>
          <div className="ctx-metric-value">{attention ? `${blockingCount} to fix` : 'Nothing to fix'}</div>
          <div className="ctx-metric-note">{attentionNote}</div>
        </div>
      )}
    </div>
  );
}

export function SavedIndicator(props: { saving: boolean }): React.ReactElement {
  return (
    <span className={`ctx-saved ${props.saving ? 'saving' : ''}`} aria-live="polite">
      <span className="ctx-saved-dot" />
      {props.saving ? 'Saving' : 'Saved'}
    </span>
  );
}

let dialogCount = 0;

/**
 * A dialog over the page. It takes the keyboard while it is open
 * (`useDialogFocus`): focus starts on its first form field or its main button,
 * Tab stays inside, Escape closes it, and focus returns to the button that
 * opened it. Its name is its title.
 */
export function Dialog(props: { title: string; children: React.ReactNode; actions: React.ReactNode; onClose: () => void }): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);
  const titleId = React.useMemo(() => `ctx-dialog-title-${++dialogCount}`, []);
  useDialogFocus(ref, props.onClose);
  return (
    <>
      <div className="ctx-backdrop" onClick={props.onClose} />
      <div className="ctx-dialog-wrap" onClick={props.onClose}>
        <div ref={ref} className="ctx-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
          <h2 id={titleId}>{props.title}</h2>
          {props.children}
          <div className="ctx-dialog-actions">{props.actions}</div>
        </div>
      </div>
    </>
  );
}

/**
 * What makes a table row open something: a click, or Enter or Space when the
 * row has the keyboard focus (Tab reaches each row). `label` is what a screen
 * reader says for the row, such as "Open PR-0041".
 */
export function openRowProps(label: string, open: () => void): React.HTMLAttributes<HTMLTableRowElement> {
  return {
    className: 'clickable',
    tabIndex: 0,
    'aria-label': label,
    onClick: open,
    onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      open();
    }
  };
}

/**
 * A file attached to a row, as a button that shows it. A quote is marked
 * "Quote" (P-021); with `showKind`, a receipt or invoice is marked "Receipt".
 */
export function FileChip(props: { file: AttachedFile; onOpen: () => void; showKind?: boolean }): React.ReactElement {
  const quote = props.file.kind === 'quote';
  const kind = quote ? 'Quote' : 'Receipt';
  return (
    <button type="button" className={`ctx-receipt-chip ${quote ? 'quote' : ''}`} title={`${kind}: ${props.file.fileName}`} onClick={props.onOpen}>
      {quote || props.showKind ? <strong>{kind}</strong> : <Icon name="file" size={13} />}
      <span>{props.file.fileName}</span>
    </button>
  );
}

/** Text that may wrap after each slash ("Advertising/Marketing/Website"), rather than in the middle of a word. */
function breakAfterSlashes(text: string): React.ReactNode {
  const parts = text.split('/');
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {part}
      {i < parts.length - 1 ? (
        <>
          /<wbr />
        </>
      ) : null}
    </React.Fragment>
  ));
}

/** A date and time ("2026-10-12 16:40") that wraps only between the two, never at a hyphen. */
export function DateTime(props: { value: string }): React.ReactElement {
  const [date, ...rest] = props.value.split(' ');
  const time = rest.join(' ');
  return (
    <span className="ctx-datetime">
      <span className="ctx-nowrap">{date}</span>
      {time ? (
        <>
          {' '}
          <span className="ctx-nowrap">{time}</span>
        </>
      ) : null}
    </span>
  );
}

/**
 * A drop-down that shows the chosen option in full, on two lines if needed,
 * instead of cutting it off (a category such as "Computer, H/W & S/W
 * Supplies" is longer than its column). The browser's own drop-down sits on
 * top, transparent, so the mouse, the keyboard and screen readers use it as
 * usual. `boxClassName` styles the visible box, `nothingChosen` greys the
 * text; the other props go to the drop-down itself.
 */
export function FullTextSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { boxClassName: string; shownText: string; nothingChosen?: boolean }
): React.ReactElement {
  const { boxClassName, shownText, nothingChosen, className, ...select } = props;
  return (
    <div className={`ctx-fullselect ${boxClassName} ${select.disabled ? 'disabled' : ''}`}>
      <span className={`ctx-fullselect-text ${nothingChosen ? 'unchosen' : ''}`} aria-hidden="true">
        {breakAfterSlashes(shownText)}
      </span>
      <select {...select} className={`ctx-fullselect-native ${className ?? ''}`} />
    </div>
  );
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'warning';
}

export function Toasts(props: { toasts: Toast[] }): React.ReactElement {
  return (
    <div className="ctx-toasts" aria-live="polite">
      {props.toasts.map((t) => (
        <div key={t.id} className={`ctx-toast ${t.tone === 'warning' ? 'warning' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function IssueLine(props: { severity: 'blocking' | 'warning'; children: React.ReactNode }): React.ReactElement {
  return (
    <div className={`ctx-issue-line ${props.severity}`}>
      <Icon name={props.severity === 'blocking' ? 'alert' : 'flag'} size={14} />
      <span>{props.children}</span>
    </div>
  );
}
