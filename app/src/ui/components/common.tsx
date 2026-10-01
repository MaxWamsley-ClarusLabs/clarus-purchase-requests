import * as React from 'react';
import { BadgeTone } from '../../domain/statuses';
import { formatCents } from '../../domain/money';
import { Totals } from '../../domain/totals';
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

export function Dialog(props: { title: string; children: React.ReactNode; actions: React.ReactNode; onClose: () => void }): React.ReactElement {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onClose]);
  return (
    <>
      <div className="ctx-backdrop" onClick={props.onClose} />
      <div className="ctx-dialog-wrap" onClick={props.onClose}>
        <div className="ctx-dialog" role="dialog" aria-modal="true" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
          <h2>{props.title}</h2>
          {props.children}
          <div className="ctx-dialog-actions">{props.actions}</div>
        </div>
      </div>
    </>
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
