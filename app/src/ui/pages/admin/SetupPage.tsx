import * as React from 'react';
import { ListCheck, SetupStatus } from '../../../data/setup';
import { useApp } from '../../AppContext';
import { Badge, Card, HeaderCard } from '../../components/common';
import { Icon } from '../../components/Icon';
import { BadgeTone } from '../../../domain/statuses';
import { FlowConfig, FlowMode, buildFlowPackage } from '../../../export/flowPackage';
import { RATE_TABLES, outdatedRateTables } from '../../../domain/rates';
import { rateText } from '../../../domain/mileage';
import { formatCents } from '../../../domain/money';
import { messages } from '../../../domain/messages';
import { todayIso } from '../../../domain/dates';
import { downloadFile } from '../../download';

/** How one list looks on the Set-up page. */
function listState(list: ListCheck): { label: string; tone: BadgeTone; details: string[] } {
  if (!list.exists) return { label: 'Not created', tone: 'lavender', details: [] };
  if (list.notOurs)
    return {
      label: 'Address in use',
      tone: 'red',
      details: [
        `Another list already uses ${list.address}, so the app has left it unchanged and cannot use this address. Renaming that list does not free the address; the app needs a new address for this list.`
      ]
    };
  const details: string[] = [];
  if (list.missingFields.length > 0) details.push(`Columns to add: ${list.missingFields.join(', ')}`);
  if (list.missingChoices.length > 0) details.push(`Choices to add: ${list.missingChoices.join('; ')}`);
  if (list.unindexedFields.length > 0) details.push(`Columns to index: ${list.unindexedFields.join(', ')}`);
  if (!list.versioning) details.push('Version history is off');
  if (!list.attachments) details.push('Attachments are off');
  if (!list.ownItemsOnly) return { label: 'Permissions not set', tone: 'red', details: ['Employees could see each other’s items', ...details] };
  if (details.length > 0) return { label: 'Needs update', tone: 'amber', details };
  return { label: 'Ready', tone: 'green', details: [] };
}

/**
 * Set-up (D-063, D-047): what the administrator does once on a new travel
 * site. Step 1 creates the lists; step 2 makes the flow package.
 */
export function SetupPage(props: { onReady?: (status: SetupStatus) => void }): React.ReactElement {
  const app = useApp();
  const [status, setStatus] = React.useState<SetupStatus | null>(null);
  const [running, setRunning] = React.useState(false);
  const [steps, setSteps] = React.useState<string[]>([]);
  const [mode, setMode] = React.useState<FlowMode>('test');
  const [making, setMaking] = React.useState(false);
  const [made, setMade] = React.useState<{ fileName: string; config: FlowConfig } | null>(null);
  const mounted = React.useRef(true);
  React.useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  React.useEffect(() => {
    app.service
      .getSetupStatus()
      .then((s) => mounted.current && setStatus(s))
      .catch(app.reportError);
  }, [app.service]);

  const run = async (): Promise<void> => {
    setRunning(true);
    setSteps([]);
    try {
      const result = await app.service.runSetup((step) => mounted.current && setSteps((s) => [...s, step]));
      if (!mounted.current) return;
      setStatus(result);
      if (result.ready) {
        app.toast('The lists are ready.');
        if (props.onReady) props.onReady(result);
      }
    } catch (e) {
      app.reportError(e);
    } finally {
      if (mounted.current) setRunning(false);
    }
  };

  // Builds the package from this site's details and downloads it (D-047).
  const makePackage = async (): Promise<void> => {
    setMaking(true);
    setMade(null);
    try {
      const config = await app.service.getFlowSettings(mode, window.location.href.split('#')[0]);
      const pkg = buildFlowPackage(config);
      downloadFile(pkg.zip, pkg.fileName, 'application/zip');
      if (mounted.current) setMade({ fileName: pkg.fileName, config });
    } catch (e) {
      app.reportError(e);
    } finally {
      if (mounted.current) setMaking(false);
    }
  };

  const outdated = outdatedRateTables(todayIso());
  const noneExist = !!status && status.lists.every((l) => !l.exists);
  const permissionsMissing = !!status && status.lists.some((l) => l.exists && !l.notOurs && !l.ownItemsOnly);

  return (
    <>
      <HeaderCard title="Set-up" subtitle="What the administrator does once for this travel site." />
      {status && !status.ready && !noneExist ? (
        <div className="ctx-banner amber" role="status">
          <Icon name="alert" />
          The lists need updating before employees can use the app.
        </div>
      ) : null}
      <div className="ctx-two-col">
        <Card title="1. Lists on this site">
          <p className="ctx-hint" style={{ marginTop: 0 }}>
            The app keeps reports in three lists on this site. Create them once. After installing a new version of the app, open this page to check them again.
          </p>
          {status === null ? (
            <div className="ctx-empty">Checking</div>
          ) : (
            <table className="ctx-table">
              <thead>
                <tr>
                  <th>List</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {status.lists.map((list) => {
                  const state = listState(list);
                  return (
                    <tr key={list.key}>
                      <td className="ctx-strong">{list.title}</td>
                      <td>
                        <Badge tone={state.tone}>{state.label}</Badge>
                        {state.details.map((d) => (
                          <div key={d} className="ctx-hint">
                            {d}
                          </div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            {status && status.ready ? (
              <button className="ctx-btn ctx-btn-secondary" disabled={running} onClick={run}>
                <Icon name="check" size={16} />
                Check again
              </button>
            ) : (
              <button className="ctx-btn ctx-btn-primary" disabled={running || status === null} onClick={run}>
                <Icon name="gear" size={16} />
                {noneExist ? 'Create the lists' : 'Update the lists'}
              </button>
            )}
            {running ? <span className="ctx-hint">Working. This takes about a minute.</span> : null}
          </div>
          {steps.length > 0 ? (
            <ul className="ctx-hint" style={{ margin: '12px 0 0', paddingLeft: 18 }}>
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : null}
          {permissionsMissing && !running ? (
            <div className="ctx-banner red" role="alert" style={{ marginTop: 16, display: 'block' }}>
              <strong>SharePoint did not accept the permission setting.</strong> Set it by hand on each list marked &quot;Permissions not set&quot;: open the
              list, then Settings (the gear) &gt; List settings &gt; Advanced settings. Under Item-level Permissions, set Read access to &quot;Read items that
              were created by the user&quot; and Create and Edit access to &quot;Create items and edit items that were created by the user&quot;. Click OK, then
              Check again here.
            </div>
          ) : null}
        </Card>
        <Card title="2. Flow package">
          <p className="ctx-hint" style={{ marginTop: 0 }}>
            The flow creates each report&apos;s folder and emails you. Make the package here, then import it in Power Automate.
          </p>
          <div className="ctx-choice-list" role="radiogroup" aria-label="Where report folders go">
            <label className="ctx-choice">
              <input type="radio" name="flow-mode" checked={mode === 'test'} onChange={() => setMode('test')} />
              <span>
                <strong>Test.</strong> Folders go to this site&apos;s Documents library, in Trips_Test &gt; Trips_To_Process. Use this on the test site.
              </span>
            </label>
            <label className="ctx-choice">
              <input type="radio" name="flow-mode" checked={mode === 'live'} onChange={() => setMode('live')} />
              <span>
                <strong>Live.</strong> Folders go to Accounting &gt; Trips &gt; Trips_To_Process on the ExecutiveTeam site.
              </span>
            </label>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="ctx-btn ctx-btn-primary" disabled={!status || !status.ready || making} onClick={makePackage}>
              <Icon name="gear" size={16} />
              Download flow package
            </button>
            {status && !status.ready ? (
              <div className="ctx-hint" style={{ marginTop: 8 }}>
                Create the lists first.
              </div>
            ) : null}
          </div>
          {made ? (
            <div className="ctx-banner green" role="status" style={{ marginTop: 16, display: 'block' }}>
              <strong>{made.fileName}</strong> downloaded. Submissions list {made.config.submissionsListId}; folders go to {made.config.destinationSiteUrl}/
              {made.config.libraryUrlName}/{made.config.folders[made.config.folders.length - 1]}; emails go to {made.config.adminEmail}.
            </div>
          ) : null}
          <ol className="ctx-hint" style={{ margin: '16px 0 0', paddingLeft: 18 }}>
            <li>In Power Automate, open My flows, then Import, then Import Package (Legacy), and upload the file.</li>
            <li>For SharePoint and for Office 365 Outlook, choose Select during import and pick your own account.</li>
            <li>Choose Import. Then open the flow and turn it on (imported flows start off).</li>
          </ol>
          <ul style={{ margin: '12px 0 0', paddingLeft: 18 }} className="ctx-hint">
            <li>The flow runs on your account when a report is submitted.</li>
            <li>It creates the report folder, copies the receipts and the CSV file into it, and emails you.</li>
            <li>It never overwrites, moves or deletes anything.</li>
          </ul>
        </Card>
      </div>
      <Card title="3. GSA rates in the app">
        <p className="ctx-hint" style={{ marginTop: 0 }}>
          The daily meal limit and the mileage rate come from GSA (D-072). They are kept in the app&apos;s code; Claude adds new rates when GSA publishes them
          (meals each October, mileage each January and sometimes mid-year), and you upload the new app package.
        </p>
        {outdated.length > 0 ? (
          <div className="ctx-banner amber" role="status" style={{ marginBottom: 12 }}>
            <Icon name="alert" />
            {messages.ratesOutdated(outdated.join(', '))}
          </div>
        ) : null}
        <table className="ctx-table">
          <thead>
            <tr>
              <th>Rate</th>
              <th>From</th>
              <th>To</th>
              <th className="num">Value</th>
            </tr>
          </thead>
          <tbody>
            {RATE_TABLES.map((t) =>
              t.table.map((p) => (
                <tr key={`${t.name}-${p.from}`}>
                  <td className="ctx-strong">{t.name}</td>
                  <td className="nowrap">{p.from}</td>
                  <td className="nowrap">{p.to}</td>
                  <td className="num">{t.name === 'Mileage' ? rateText(p.value) : `${formatCents(p.value)} a day`}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
