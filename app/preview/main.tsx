// Prototype preview (Stage 6). Runs the real app on synthetic sample data.
// Query options: ?user=jane|sam|admin chooses who is signed in; &shot=1 hides
// the preview bar (used for screenshots); &setup=new shows a site whose lists
// do not exist yet; &reader=off turns receipt suggestions off; &flow=off acts
// as if the flow were turned off, so approval emails and packages stay waiting
// (after 30 minutes they show under Needs attention, with Retry); &reset=1 starts
// again from the sample data. The sample data is kept in this tab's session
// storage, so switching between people shows the same requests and the approval
// can be followed end to end: Jane sends a request, Max approves it, Jane
// submits it, Max processes it. Nothing here ships in the app.
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import { App } from '../src/ui/App';
import { MockDataService, notSetUp } from '../src/data/mock/MockDataService';
import { SAMPLE_USERS, SampleStore, createSampleStore, finishPendingWork } from '../src/data/mock/sampleData';
import { readerAssetsIn } from '../src/reading/assets';
import { createReceiptReader } from '../src/reading/ReceiptReader';
import logoUrl from '../src/ui/assets/clarus-logo.png';

type UserKey = keyof typeof SAMPLE_USERS;
const STORE_KEY = 'purchase-requests-preview-store';

const params = new URLSearchParams(window.location.search);
const userKey = (params.get('user') as UserKey) in SAMPLE_USERS ? (params.get('user') as UserKey) : 'jane';

// Storage can be unavailable (private windows, blocked site data): the preview
// then works from the sample data as it was at the start, and each page load starts again.
function saveStore(store: SampleStore): void {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Not kept; the preview still works.
  }
}

// With &flow=off the simulated flow's steps wait a day, so nothing it would do happens in a
// preview session; the service's own calls still take a moment, as they never wait longer than a step.
const flowOff = params.get('flow') === 'off';
const FLOW_STEP_MS = flowOff ? 24 * 60 * 60 * 1000 : 1500;

/**
 * The kept sample data, with the work the simulated flow had still to do finished (its timers
 * died with the last page), unless the flow is off: that work then stays waiting.
 */
function restoreStore(): SampleStore | null {
  try {
    const text = window.sessionStorage.getItem(STORE_KEY);
    if (!text) return null;
    const saved = JSON.parse(text) as SampleStore;
    if (!Array.isArray(saved.requests) || !Array.isArray(saved.lines) || !Array.isArray(saved.submissions)) return null;
    if (!flowOff) finishPendingWork(saved);
    return saved;
  } catch {
    return null;
  }
}

const store = (params.get('reset') ? null : restoreStore()) ?? createSampleStore();
saveStore(store);
const service = new MockDataService(store, SAMPLE_USERS[userKey], FLOW_STEP_MS, () => saveStore(store));
if (params.get('setup') === 'new') service.setupStatus = notSetUp();
// The receipt reader's files are served at /reader/ (vite.config.mts).
const reader =
  params.get('reader') === 'off'
    ? null
    : createReceiptReader(readerAssetsIn(new URL('reader/', document.baseURI).href), (reason) => console.warn('Receipt suggestions could not start.', reason));
// For preview/tools/check-reader.mjs, which measures the reader on the test receipts.
(window as unknown as { previewReader: typeof reader }).previewReader = reader;

function PreviewBar(): React.ReactElement {
  const switchTo = (key: UserKey) => {
    const next = new URLSearchParams(window.location.search);
    next.set('user', key);
    // Switching people keeps the sample data; only "Reset sample data" starts again.
    next.delete('reset');
    window.location.search = next.toString();
  };
  const reset = () => {
    try {
      window.sessionStorage.removeItem(STORE_KEY);
    } catch {
      // Nothing was kept.
    }
    const next = new URLSearchParams(window.location.search);
    next.delete('reset');
    window.history.replaceState(null, '', `${window.location.pathname}?${next.toString()}#/`);
    window.location.reload();
  };
  return (
    <div className="preview-bar">
      <span>Prototype preview as:</span>
      {(Object.keys(SAMPLE_USERS) as UserKey[]).map((k) => (
        <button key={k} className={k === userKey ? 'on' : ''} onClick={() => switchTo(k)}>
          {SAMPLE_USERS[k].displayName}
          {SAMPLE_USERS[k].isAdministrator ? ' (admin)' : ''}
        </button>
      ))}
      <button onClick={reset}>Reset sample data</button>
    </div>
  );
}

ReactDOM.render(
  <>
    <App service={service} logoUrl={logoUrl} reader={reader} />
    {params.get('shot') ? null : <PreviewBar />}
  </>,
  document.getElementById('root')
);
