import * as React from 'react';
import { messages } from '../../../domain/messages';
import { formatCents } from '../../../domain/money';
import { useApp } from '../../AppContext';
import { Card, DateTime, HeaderCard, Tag, openRowProps } from '../../components/common';
import { Icon } from '../../components/Icon';
import { latestApprovalByRequest, requestsAwaitingApproval } from './adminData';
import { useAdminLists } from './useAdminLists';

/** Requests waiting for the approver (P-006). Each also arrives as an email (P-018). */
export function ApprovalsPage(): React.ReactElement {
  const app = useApp();
  const { data, loadError } = useAdminLists();
  const waiting = data ? requestsAwaitingApproval(data.requests) : null;
  const approvalEmails = data ? latestApprovalByRequest(data.submissions) : new Map();

  return (
    <>
      <HeaderCard title="Approvals" subtitle="Requests waiting for your approval. You also get an email for each one." />
      {loadError ? (
        <div className="ctx-banner red" role="alert">
          {messages.loadFailed}
        </div>
      ) : null}
      <Card title="Waiting for approval">
        {waiting === null ? (
          <div className="ctx-empty">Loading</div>
        ) : waiting.length === 0 ? (
          <div className="ctx-empty">
            <Icon name="check" size={28} />
            <h3>Nothing to approve</h3>
            Requests sent for approval appear here.
          </div>
        ) : (
          <div className="ctx-table-wrap">
            <table className="ctx-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Requested by</th>
                  <th>Business purpose</th>
                  <th>Sent</th>
                  <th className="num">Needs approval</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                {waiting.map((r) => {
                  const sent = approvalEmails.get(r.id);
                  const cents = r.approval.sent.reduce((sum, g) => sum + g.cents, 0);
                  const count = r.approval.sent.length;
                  return (
                    <tr key={r.id} {...openRowProps(`Open ${r.requestNumber}`, () => app.navigate({ name: 'adminRequest', requestId: r.id }))}>
                      <td className="ctx-strong nowrap">{r.requestNumber}</td>
                      <td>{r.ownerName}</td>
                      <td>{r.businessPurpose}</td>
                      <td className="ctx-muted">
                        <DateTime value={sent ? sent.submittedOn : r.sentForApprovalOn} />
                      </td>
                      <td className="num">
                        {formatCents(cents)}
                        <div className="ctx-hint">{count === 1 ? '1 vendor total' : `${count} vendor totals`}</div>
                      </td>
                      <td>{r.boughtBeforeApproval ? <Tag>Bought before approval</Tag> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
