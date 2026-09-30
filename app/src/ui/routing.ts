// Pages are addressed by the part of the web address after "#", so a link or
// a refresh opens the same page.

import * as React from 'react';

export type ReportStep = 'trip' | 'expenses' | 'review';

export type Route =
  | { name: 'home' }
  | { name: 'report'; reportId: number; step: ReportStep }
  | { name: 'adminProcess' }
  | { name: 'adminAttention' }
  | { name: 'adminAll' }
  | { name: 'adminReport'; reportId: number }
  | { name: 'setup' };

export interface Location {
  route: Route;
  /** Optional panel to open, for example "#/report/41/expenses?panel=instructions". */
  panel: string;
}

export function parseHash(hash: string): Location {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter((p) => p.length > 0);
  const panel = new URLSearchParams(query).get('panel') ?? '';
  const id = Number(parts[2] ?? parts[1]);
  let route: Route = { name: 'home' };
  if (parts[0] === 'report' && Number.isInteger(Number(parts[1]))) {
    const step = parts[2] === 'expenses' || parts[2] === 'review' ? parts[2] : 'trip';
    route = { name: 'report', reportId: Number(parts[1]), step };
  } else if (parts[0] === 'admin') {
    if (parts[1] === 'process') route = { name: 'adminProcess' };
    else if (parts[1] === 'attention') route = { name: 'adminAttention' };
    else if (parts[1] === 'all') route = { name: 'adminAll' };
    // 'flow-setup' was this page's address in the prototype.
    else if (parts[1] === 'setup' || parts[1] === 'flow-setup') route = { name: 'setup' };
    else if (parts[1] === 'report' && Number.isInteger(id)) route = { name: 'adminReport', reportId: id };
  }
  return { route, panel };
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'report':
      return `#/report/${route.reportId}/${route.step}`;
    case 'adminProcess':
      return '#/admin/process';
    case 'adminAttention':
      return '#/admin/attention';
    case 'adminAll':
      return '#/admin/all';
    case 'adminReport':
      return `#/admin/report/${route.reportId}`;
    case 'setup':
      return '#/admin/setup';
  }
}

export function useLocation(): [Location, (route: Route) => void] {
  const [location, setLocation] = React.useState<Location>(() => parseHash(window.location.hash));
  React.useEffect(() => {
    const onChange = () => setLocation(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = React.useCallback((route: Route) => {
    window.location.hash = toHash(route);
  }, []);
  return [location, navigate];
}
