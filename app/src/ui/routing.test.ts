import { Route, parseHash, toHash } from './routing';

// The flow's emails link to the administrator addresses, so they must not change.
describe('page addresses', () => {
  const routes: [string, Route][] = [
    ['#/', { name: 'home' }],
    ['#/request/41/details', { name: 'request', requestId: 41, step: 'details' }],
    ['#/request/41/purchases', { name: 'request', requestId: 41, step: 'purchases' }],
    ['#/request/41/review', { name: 'request', requestId: 41, step: 'review' }],
    ['#/admin/approvals', { name: 'adminApprovals' }],
    ['#/admin/process', { name: 'adminProcess' }],
    ['#/admin/attention', { name: 'adminAttention' }],
    ['#/admin/all', { name: 'adminAll' }],
    ['#/admin/request/42', { name: 'adminRequest', requestId: 42 }],
    ['#/admin/setup', { name: 'setup' }]
  ];

  it.each(routes)('%s is the address of one page, both ways', (hash, route) => {
    expect(parseHash(hash).route).toEqual(route);
    expect(toHash(route)).toBe(hash);
  });

  it('opens the request details when no step is given, or the step is not one of the three', () => {
    expect(parseHash('#/request/41').route).toEqual({ name: 'request', requestId: 41, step: 'details' });
    expect(parseHash('#/request/41/trip').route).toEqual({ name: 'request', requestId: 41, step: 'details' });
  });

  it('opens My requests for an address it does not know, or a request number that is not a number', () => {
    for (const hash of [
      '',
      '#',
      '#/nowhere',
      '#/request',
      '#/request/abc/review',
      '#/request/4.1/review',
      '#/request/-1/review',
      '#/admin',
      '#/admin/request/x'
    ]) {
      expect(parseHash(hash).route).toEqual({ name: 'home' });
    }
  });

  it('reads the panel to open', () => {
    expect(parseHash('#/request/41/purchases?panel=instructions')).toEqual({
      route: { name: 'request', requestId: 41, step: 'purchases' },
      panel: 'instructions'
    });
    expect(parseHash('#/').panel).toBe('');
  });
});
