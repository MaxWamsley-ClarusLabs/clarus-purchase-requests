import * as React from 'react';
import { useApp } from '../AppContext';
import { useMountedRef } from '../hooks';
import { Icon } from './Icon';

/**
 * Starts a request for a purchase the administrator has already made (P-051). It is a new request of their own
 * that the approver buys (the default); the request page then lets them attach the receipts and record it
 * without sending it for approval. Shown only on the administrator's pages.
 */
export function RecordPurchaseButton(): React.ReactElement {
  const app = useApp();
  const [starting, setStarting] = React.useState(false);
  const mounted = useMountedRef();

  const start = async (): Promise<void> => {
    setStarting(true);
    try {
      const request = await app.service.createRequest();
      app.navigate({ name: 'request', requestId: request.id, step: 'details' });
    } catch (e) {
      if (mounted.current) setStarting(false);
      app.reportError(e);
    }
  };

  return (
    <button
      className="ctx-btn ctx-btn-primary"
      onClick={start}
      disabled={starting}
      title="Record a purchase you already made, with its receipt, without approval"
    >
      <Icon name="plus" size={16} />
      Record a purchase
    </button>
  );
}
