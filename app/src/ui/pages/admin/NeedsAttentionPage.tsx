import * as React from 'react';
import { CrossEmployeeMatch, findCrossEmployeeDuplicates } from '../../../domain/duplicates';
import { formatCents } from '../../../domain/money';
import { PACKAGE_STATUS_DISPLAY } from '../../../domain/statuses';
import { Submission } from '../../../domain/types';
import { useApp } from '../../AppContext';
import { Badge, Card, HeaderCard } from '../../components/common';
import { Icon } from '../../components/Icon';
import { latestByReport, needsAttention } from './adminData';

export function NeedsAttentionPage(): React.ReactElement {
  const app = useApp();
  const [stuck, setStuck] = React.useState<Submission[] | null>(null);
  const [duplicates, setDuplicates] = React.useState<CrossEmployeeMatch[]>([]);

  React.useEffect(() => {
    Promise.all([app.service.listSubmissions(), app.service.listAllLineRefs()])
      .then(([subs, refs]) => {
        setStuck(Array.from(latestByReport(subs).values()).filter((s) => needsAttention(s)));
        setDuplicates(findCrossEmployeeDuplicates(refs));
      })
      .catch(app.reportError);
  }, [app.service]);

  return (
    <>
      <HeaderCard title="Needs attention" subtitle="Folders that were not created, and possible duplicates between employees." />
      <Card title="Folders not created">
        {stuck === null ? (
          <div className="ctx-empty">Loading</div>
        ) : stuck.length === 0 ? (
          <div className="ctx-banner green">
            <Icon name="check" />
            Every submission has its folder.
          </div>
        ) : (
          <>
            <div className="ctx-hint" style={{ marginBottom: 10 }}>
              A submission appears here if packaging failed, or if its folder was not created within 30 minutes. That usually means the flow&apos;s connection
              needs signing in again, or the flow was turned off. The SOP explains both.
            </div>
            <table className="ctx-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Submitted by</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {stuck.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => app.navigate({ name: 'adminReport', reportId: s.reportId })}>
                    <td className="ctx-strong">{s.reportNumber}</td>
                    <td>{s.submitterName}</td>
                    <td className="ctx-muted">{s.submittedOn}</td>
                    <td>
                      <Badge tone={PACKAGE_STATUS_DISPLAY[s.packageStatus].tone}>{PACKAGE_STATUS_DISPLAY[s.packageStatus].label}</Badge>
                    </td>
                    <td>{s.errorMessage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              The same receipt file, or the same date, vendor and amount, in two employees&apos; reports. Employees cannot see each other&apos;s reports, so
              only you see these.
            </div>
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
                      {d.a.reportNumber} row {d.a.line.rowNumber}
                    </td>
                    <td>
                      {d.b.reportNumber} row {d.b.line.rowNumber}
                    </td>
                    <td>{d.a.line.vendor}</td>
                    <td>{d.a.line.date}</td>
                    <td className="num">{d.a.line.amountCents === null ? '' : formatCents(d.a.line.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </>
  );
}
