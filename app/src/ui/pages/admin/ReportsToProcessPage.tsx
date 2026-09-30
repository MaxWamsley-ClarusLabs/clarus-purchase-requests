import * as React from 'react';
import { messages } from '../../../domain/messages';
import { outdatedRateTables } from '../../../domain/rates';
import { todayIso } from '../../../domain/dates';
import { formatCents } from '../../../domain/money';
import { PACKAGE_STATUS_DISPLAY } from '../../../domain/statuses';
import { Submission, TravelReport } from '../../../domain/types';
import { useApp } from '../../AppContext';
import { Badge, Card, HeaderCard } from '../../components/common';
import { Icon } from '../../components/Icon';
import { latestByReport, reportsToProcess } from './adminData';

export function ReportsToProcessPage(): React.ReactElement {
  const app = useApp();
  const [data, setData] = React.useState<{ reports: TravelReport[]; latest: Map<number, Submission> } | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const outdated = outdatedRateTables(todayIso());

  React.useEffect(() => {
    let alive = true;
    // Refreshed every few seconds. A failure shows a notice until the next
    // successful refresh.
    const load = async (): Promise<void> => {
      try {
        const [reports, submissions] = await Promise.all([app.service.listAllReports(), app.service.listSubmissions()]);
        if (!alive) return;
        setData({ reports: reportsToProcess(reports), latest: latestByReport(submissions) });
        setLoadError(false);
      } catch {
        if (alive) setLoadError(true);
      }
    };
    void load();
    const t = window.setInterval(() => {
      void load();
    }, 3000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [app.service]);

  return (
    <>
      <HeaderCard title="Reports to process" subtitle="Submitted reports waiting for you. Their folders are in Accounting > Trips > Trips_To_Process." />
      {outdated.length > 0 ? (
        <div className="ctx-banner amber" role="status">
          {messages.ratesOutdated(outdated.join(', '))}
        </div>
      ) : null}
      {loadError ? (
        <div className="ctx-banner red" role="alert">
          {messages.loadFailed}
        </div>
      ) : null}
      <Card title="Waiting">
        {data === null ? (
          <div className="ctx-empty">Loading</div>
        ) : data.reports.length === 0 ? (
          <div className="ctx-empty">
            <Icon name="check" size={28} />
            <h3>Nothing to process</h3>
            New submissions appear here and are emailed to you.
          </div>
        ) : (
          <table className="ctx-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Submitted by</th>
                <th>Trip</th>
                <th>Submitted</th>
                <th>Folder</th>
                <th className="num">To reimburse</th>
                <th className="num">Trip total</th>
              </tr>
            </thead>
            <tbody>
              {data.reports.map((r) => {
                const s = data.latest.get(r.id);
                const pkg = s ? PACKAGE_STATUS_DISPLAY[s.packageStatus] : null;
                return (
                  <tr key={r.id} className="clickable" onClick={() => app.navigate({ name: 'adminReport', reportId: r.id })}>
                    <td className="ctx-strong">
                      {r.reportNumber}
                      {s && s.submissionNumber > 1 ? ` (R${s.submissionNumber})` : ''}
                    </td>
                    <td>{r.ownerName}</td>
                    <td>{r.tripName}</td>
                    <td className="ctx-muted">{r.submittedOn}</td>
                    <td>{pkg ? <Badge tone={pkg.tone}>{pkg.label}</Badge> : null}</td>
                    <td className="num">{formatCents(r.totalReimburseCents)}</td>
                    <td className="num">{formatCents(r.totalTripCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <div className="ctx-hint">
        After processing a report: move its folder from Trips_To_Process into the Trips folder for the year the trip started, then open the report here and
        click Mark processed.
      </div>
    </>
  );
}
