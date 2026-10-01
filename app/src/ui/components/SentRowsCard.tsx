import * as React from 'react';
import { formatCents } from '../../domain/money';
import { sameAsSent } from '../../domain/purchaseRules';
import { PurchaseLine, PurchaseRequest } from '../../domain/types';
import { Card, ItemLinkText } from './common';

/**
 * The rows as the employee sent them, for a request the approver buys (P-040),
 * so what was bought can be read against what was asked for. Text only: nothing
 * stored here is shown as HTML, and a web address is a link only if it is safe.
 */
export function SentRowsCard(props: { request: PurchaseRequest; lines: PurchaseLine[]; forApprover: boolean }): React.ReactElement | null {
  const { request, lines } = props;
  const rows = request.approval.rows ?? [];
  const sentStatuses: PurchaseRequest['status'][] = ['Awaiting approval', 'Approved', 'Submitted', 'Processed'];
  if (request.buyer !== 'approver' || rows.length === 0 || !sentStatuses.includes(request.status)) return null;
  const same = sameAsSent(lines, rows);
  return (
    <Card title="As sent for approval">
      <div className="ctx-hint" style={{ marginBottom: 8 }}>
        {request.ownerName} sent these rows{request.sentForApprovalOn ? ` on ${request.sentForApprovalOn}` : ''}.
        {props.forApprover ? (same ? ' The rows are still as sent.' : ' The rows above were changed when the request was bought.') : ''}
      </div>
      <div className="ctx-table-wrap">
        <table className="ctx-table compact">
          <thead>
            <tr>
              <th>#</th>
              <th>Vendor</th>
              <th>What to buy and why</th>
              <th>Category</th>
              <th>Item link</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rowNumber}>
                <td>{r.rowNumber}</td>
                <td>{r.vendor}</td>
                <td>{r.description}</td>
                <td>{r.category}</td>
                <td>
                  {r.itemLink.trim() ? (
                    <ItemLinkText value={r.itemLink} maxChars={30} />
                  ) : r.noLinkReason.trim() ? (
                    <span className="ctx-muted">{r.noLinkReason}</span>
                  ) : null}
                </td>
                <td className="num">{r.amountCents === null ? '' : formatCents(r.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
