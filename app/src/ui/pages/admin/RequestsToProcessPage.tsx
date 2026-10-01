import * as React from 'react';
import { messages } from '../../../domain/messages';
import { formatCents } from '../../../domain/money';
import { submissionStatusDisplay } from '../../../domain/statuses';
import { useApp } from '../../AppContext';
import { Badge, Card, HeaderCard, Tag } from '../../components/common';
import { Icon } from '../../components/Icon';
import { latestByRequest, requestsToProcess } from './adminData';
import { useAdminLists } from './useAdminLists';

export function RequestsToProcessPage(): React.ReactElement {
  const app = useApp();
  const { data, loadError } = useAdminLists();
  const waiting = data ? requestsToProcess(data.requests) : null;
  const packages = data ? latestByRequest(data.submissions) : new Map();

  return (
    <>
      <HeaderCard
        title="Requests to process"
        subtitle="Submitted requests waiting for you. Their folders are in Accounting > Purchases > Purchases_To_Process."
      />
      {loadError ? (
        <div className="ctx-banner red" role="alert">
          {messages.loadFailed}
        </div>
      ) : null}
      <Card title="Waiting">
        {waiting === null ? (
          <div className="ctx-empty">Loading</div>
        ) : waiting.length === 0 ? (
          <div className="ctx-empty">
            <Icon name="check" size={28} />
            <h3>Nothing to process</h3>
            New submissions appear here and are emailed to you.
          </div>
        ) : (
          <table className="ctx-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Submitted by</th>
                <th>Business purpose</th>
                <th>Submitted</th>
                <th>Folder</th>
                <th className="num">To reimburse</th>
                <th className="num">Request total</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((r) => {
                const s = packages.get(r.id);
                const pkg = s ? submissionStatusDisplay('package', s.packageStatus) : null;
                return (
                  <tr key={r.id} className="clickable" onClick={() => app.navigate({ name: 'adminRequest', requestId: r.id })}>
                    <td className="ctx-strong nowrap">
                      {r.requestNumber}
                      {s && s.submissionNumber > 1 ? ` (R${s.submissionNumber})` : ''}
                    </td>
                    <td>{r.ownerName}</td>
                    <td>{r.businessPurpose}</td>
                    <td className="ctx-muted nowrap">{r.submittedOn}</td>
                    <td>{pkg ? <Badge tone={pkg.tone}>{pkg.label}</Badge> : null}</td>
                    <td className="num">{formatCents(r.totalReimburseCents)}</td>
                    <td className="num">{formatCents(r.totalRequestCents)}</td>
                    <td>{r.boughtBeforeApproval ? <Tag>Bought before approval</Tag> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <div className="ctx-hint">
        After processing a request: move its folder from Purchases_To_Process into the Purchases folder for the year of the earliest purchase date, then open
        the request here and click Mark processed.
      </div>
    </>
  );
}
