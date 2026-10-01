import * as React from 'react';
import { CrossEmployeeMatch, findCrossEmployeeDuplicates } from '../../../domain/duplicates';
import { formatCents } from '../../../domain/money';
import { PACKAGE_ATTENTION_MINUTES, submissionStatusDisplay } from '../../../domain/statuses';
import { Submission } from '../../../domain/types';
import { useApp } from '../../AppContext';
import { useMountedRef } from '../../hooks';
import { Badge, Card, DateTime, HeaderCard, openRowProps } from '../../components/common';
import { Icon } from '../../components/Icon';
import { stuckSubmissions } from './adminData';

export function NeedsAttentionPage(): React.ReactElement {
  const app = useApp();
  const [stuck, setStuck] = React.useState<Submission[] | null>(null);
  const [duplicates, setDuplicates] = React.useState<CrossEmployeeMatch[]>([]);
  const mounted = useMountedRef();

  React.useEffect(() => {
    Promise.all([app.service.listAllRequests(), app.service.listSubmissions(), app.service.listAllLineRefs()])
      .then(([requests, subs, refs]) => {
        if (!mounted.current) return;
        setStuck(stuckSubmissions(requests, subs));
        setDuplicates(findCrossEmployeeDuplicates(refs));
      })
      .catch(app.reportError);
  }, [app.service]);

  return (
    <>
      <HeaderCard title="Needs attention" subtitle="Approval emails not sent, folders not created, and possible duplicates between employees." />
      <Card title="Emails and folders not completed">
        {stuck === null ? (
          <div className="ctx-empty">Loading</div>
        ) : stuck.length === 0 ? (
          <div className="ctx-banner green">
            <Icon name="check" />
            Every approval email was sent and every folder was created.
          </div>
        ) : (
          <>
            <div className="ctx-hint" style={{ marginBottom: 10 }}>
              A submission appears here if its approval email was not sent, or its folder was not created, because it failed or took more than{' '}
              {PACKAGE_ATTENTION_MINUTES} minutes. That usually means the flow&apos;s connection needs signing in again, or the flow was turned off. Open the
              request to try again. The SOP explains both.
            </div>
            <div className="ctx-table-wrap">
              <table className="ctx-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Type</th>
                    <th>Submitted by</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {stuck.map((s) => {
                    const display = submissionStatusDisplay(s.type, s.packageStatus);
                    return (
                      <tr key={s.id} {...openRowProps(`Open ${s.requestNumber}`, () => app.navigate({ name: 'adminRequest', requestId: s.requestId }))}>
                        <td className="ctx-strong nowrap">{s.requestNumber}</td>
                        <td className="nowrap">{s.type === 'approval' ? 'Approval email' : 'Package'}</td>
                        <td>{s.submitterName}</td>
                        <td className="ctx-muted">
                          <DateTime value={s.submittedOn} />
                        </td>
                        <td>
                          <Badge tone={display.tone}>{display.label}</Badge>
                        </td>
                        <td>{s.errorMessage}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
      <Card title="Possible duplicates between employees">
        {duplicates.length === 0 ? (
          <div className="ctx-banner green">
            <Icon name="check" />
            No possible duplicates found.
          </div>
        ) : (
          <>
            <div className="ctx-hint" style={{ marginBottom: 10 }}>
              The same receipt file, or the same date, vendor and amount, in two employees&apos; requests. Employees cannot see each other&apos;s requests, so
              only you see these.
            </div>
            <div className="ctx-table-wrap">
              <table className="ctx-table">
                <thead>
                  <tr>
                    <th>Match</th>
                    <th>First</th>
                    <th>Second</th>
                    <th>Vendor</th>
                    <th>Date</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicates.map((d, i) => (
                    <tr key={i}>
                      <td>
                        <Badge tone="amber">{d.kind === 'file' ? 'Same file' : 'Same date, vendor, amount'}</Badge>
                      </td>
                      <td>
                        {d.a.requestNumber} row {d.a.line.rowNumber}
                      </td>
                      <td>
                        {d.b.requestNumber} row {d.b.line.rowNumber}
                      </td>
                      <td>{d.a.line.vendor}</td>
                      <td>{d.a.line.date}</td>
                      <td className="num">{d.a.line.amountCents === null ? '' : formatCents(d.a.line.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
