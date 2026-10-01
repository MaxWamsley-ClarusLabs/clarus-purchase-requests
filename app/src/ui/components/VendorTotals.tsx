import * as React from 'react';
import { formatCents } from '../../domain/money';
import { APPROVAL_THRESHOLD_TEXT } from '../../domain/purchaseRules';
import { BadgeTone } from '../../domain/statuses';
import { PurchaseLine, PurchaseRequest } from '../../domain/types';
import { VENDOR_APPROVAL_LABEL, quoteText, rowsText, vendorRows } from '../vendorRows';
import { Badge, Tag } from './common';

const APPROVAL_TONE: Record<keyof typeof VENDOR_APPROVAL_LABEL, BadgeTone> = {
  notRequired: 'lavender',
  needed: 'amber',
  pending: 'amber',
  approved: 'green',
  changed: 'amber'
};

/**
 * Each vendor's total in the request, whether it needs approval and a quote,
 * and where it stands (P-015, P-016, P-019). Totals are by vendor within the
 * request, so splitting a purchase across rows does not avoid the threshold.
 * `showApproved` adds the amount the approver approved (administrator page).
 */
export function VendorTotals(props: {
  lines: PurchaseLine[];
  request: Pick<PurchaseRequest, 'status' | 'approval'>;
  showApproved?: boolean;
  showIntro?: boolean;
}): React.ReactElement {
  const rows = vendorRows(props.lines, props.request);
  return (
    <div>
      {props.showIntro ? (
        <div className="ctx-hint" style={{ marginBottom: 10 }}>
          A vendor total of {APPROVAL_THRESHOLD_TEXT} or more needs approval before you buy, and a quote or a reason.
        </div>
      ) : null}
      {rows.length === 0 ? (
        <div className="ctx-hint">Add purchases to see the vendor totals.</div>
      ) : (
        <table className="ctx-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th className="num">Total</th>
              {props.showApproved ? <th className="num">Approved</th> : null}
              <th>Approval</th>
              <th>Quote</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.group.key}>
                <td>
                  <span className="ctx-strong">{r.group.vendor || <span className="ctx-muted">No vendor yet</span>}</span>
                  <div className="ctx-hint">{rowsText(r.rows)}</div>
                </td>
                <td className="num">{formatCents(r.group.totalCents)}</td>
                {props.showApproved ? (
                  <td className="num">{r.approvedCents === null ? <span className="ctx-muted">-</span> : formatCents(r.approvedCents)}</td>
                ) : null}
                <td>
                  <Badge tone={APPROVAL_TONE[r.approval]}>{VENDOR_APPROVAL_LABEL[r.approval]}</Badge>
                  {r.boughtBefore ? (
                    <>
                      {' '}
                      <Tag>Bought before approval</Tag>
                    </>
                  ) : null}
                </td>
                <td>
                  {r.quote.kind === 'notNeeded' ? (
                    <span className="ctx-muted" title="No quote is needed">
                      -
                    </span>
                  ) : r.quote.kind === 'missing' ? (
                    <Badge tone="amber">{quoteText(r.quote)}</Badge>
                  ) : (
                    quoteText(r.quote)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
