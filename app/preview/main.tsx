// Prototype preview (Stage 6). Runs the real app on synthetic sample data.
// Query options: ?user=jane|sam|admin chooses who is signed in; &shot=1 hides
// the preview bar (used for screenshots); &setup=new shows a travel site whose
// lists do not exist yet; &reader=off turns receipt suggestions off. Nothing
// here ships in the app.
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import { App } from '../src/ui/App';
import { MockDataService, notSetUp } from '../src/data/mock/MockDataService';
import { createSampleStore, SAMPLE_USERS } from '../src/data/mock/sampleData';
import { readerAssetsIn } from '../src/reading/assets';
import { createReceiptReader } from '../src/reading/ReceiptReader';
import logoUrl from '../src/ui/assets/clarus-logo.png';

type UserKey = keyof typeof SAMPLE_USERS;
const params = new URLSearchParams(window.location.search);
const userKey = (params.get('user') as UserKey) in SAMPLE_USERS ? (params.get('user') as UserKey) : 'jane';
const store = createSampleStore();
const service = new MockDataService(store, SAMPLE_USERS[userKey]);
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
    window.location.search = next.toString();
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
      <button onClick={() => window.location.reload()}>Reset sample data</button>
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
