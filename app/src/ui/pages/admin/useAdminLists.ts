import * as React from 'react';
import { PurchaseRequest, Submission } from '../../../domain/types';
import { useApp } from '../../AppContext';

export interface AdminLists {
  requests: PurchaseRequest[];
  submissions: Submission[];
}

const REFRESH_MS = 3000;

/**
 * Every request and submission, refreshed every few seconds, for the lists the
 * administrator keeps open (Approvals, Requests to process). A failure shows a
 * notice until the next successful refresh.
 */
export function useAdminLists(): { data: AdminLists | null; loadError: boolean } {
  const app = useApp();
  const [data, setData] = React.useState<AdminLists | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const [requests, submissions] = await Promise.all([app.service.listAllRequests(), app.service.listSubmissions()]);
        if (!alive) return;
        setData({ requests, submissions });
        setLoadError(false);
      } catch {
        if (alive) setLoadError(true);
      }
    };
    void load();
    const t = window.setInterval(() => {
      void load();
    }, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [app.service]);

  return { data, loadError };
}
