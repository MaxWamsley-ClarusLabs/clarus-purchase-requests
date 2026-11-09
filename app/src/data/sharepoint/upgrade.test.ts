// The upgrade of a site that already holds requests (P-047 to P-051): the new app is installed over the old one,
// and Set-up adds the Quantity and Row type columns. This makes a site look as the previous version left it, with
// requests at every stage and no new columns, then runs the new app over it. Nothing already tracked may be lost,
// changed or hidden, and every step that worked before must still work.

import { CERTIFICATION } from '../../domain/purchaseRules';
import { FakeSharePoint, FakeUser } from '../../testing/FakeSharePoint';
import { PurchaseDataService } from '../PurchaseDataService';
import { SpClient } from './http';
import { SharePointDataService } from './SharePointDataService';

const MAX: FakeUser = { id: 1, title: 'Max Wamsley', email: 'max.wamsley@example.com', admin: true };
const JANE: FakeUser = { id: 7, title: 'Jane Doe', email: 'jane.doe@example.com', admin: false };
const NOW = new Date(2026, 9, 16, 9, 30);
const NEW_COLUMNS = ['Quantity', 'RowKind'];
const LISTS = ['PurchaseRequests', 'PurchaseRequestLines', 'PurchaseSubmissions'] as const;

const serviceFor = (site: FakeSharePoint, user: FakeUser): PurchaseDataService =>
  new SharePointDataService(new SpClient(site.fetchAs(user), site.webUrl, site.webPath, async () => undefined), () => NOW);

const pdf = (name: string) => new File([`synthetic ${name}`], name, { type: 'application/pdf' });

/** A request with one row. `buyer` approver: the approver buys it (the default). */
async function makeRequest(
  svc: PurchaseDataService,
  purpose: string,
  row: { vendor: string; cents: number; paidBy?: 'company' | 'employee'; noQuote?: string },
  buyer: 'approver' | 'self'
) {
  const created = await svc.createRequest();
  await svc.updateRequest(created.id, { buyer, businessPurpose: purpose, department: 'R&D', projectCode: 'NSF SBIR Phase 1' });
  const line = await svc.addEmptyLine(created.id);
  await svc.updateLine(line.id, {
    date: '2026-10-12',
    vendor: row.vendor,
    description: 'Supplies',
    category: 'rdMaterials',
    amountCents: row.cents,
    paidBy: row.paidBy ?? 'company',
    noQuoteReason: row.noQuote ?? '',
    ...(buyer === 'approver' ? { itemLink: 'https://www.example.com/item' } : {})
  });
  return { id: created.id, lineId: line.id };
}

/** Every stored value of every list, without the columns the update adds, as a snapshot to compare. */
function snapshot(site: FakeSharePoint): Record<string, Record<number, Record<string, unknown>>> {
  const out: Record<string, Record<number, Record<string, unknown>>> = {};
  for (const name of LISTS) {
    out[name] = {};
    for (const [id, item] of site.listByUrlName(name)!.items) {
      const fields = { ...item.fields };
      for (const column of NEW_COLUMNS) delete fields[column];
      out[name][id] = { ...fields, attachments: item.attachments.map((a) => a.name ?? JSON.stringify(a)) };
    }
  }
  return out;
}

describe('installing the new version over a site that already holds requests', () => {
  async function previousVersionSite() {
    const site = new FakeSharePoint();
    await serviceFor(site, MAX).runSetup(() => undefined);
    const jane = serviceFor(site, JANE);
    const max = serviceFor(site, MAX);
    // 1. A draft nobody has sent.
    const draft = await makeRequest(jane, 'Draft from before', { vendor: 'Acme Lab Supply', cents: 12000 }, 'approver');
    // 2. A request waiting for approval.
    const waiting = await makeRequest(jane, 'Waiting from before', { vendor: 'Borealis Optics', cents: 64000, noQuote: 'Sole source' }, 'approver');
    await jane.sendForApproval(waiting.id, CERTIFICATION);
    // 3. A request the employee bought and submitted, still to process.
    const submitted = await makeRequest(jane, 'Submitted from before', { vendor: 'Northwind Office Supply', cents: 8645, paidBy: 'employee' }, 'self');
    await jane.addFileToLine(submitted.lineId, pdf('receipt.pdf'), 'receipt');
    await jane.submitRequest(submitted.id, CERTIFICATION);
    // 4. A request the approver bought, and that is processed.
    const done = await makeRequest(jane, 'Processed from before', { vendor: 'Thorlabs', cents: 20000 }, 'approver');
    await jane.sendForApproval(done.id, CERTIFICATION);
    await max.approveRequest(done.id, { note: 'OK', categories: {} });
    await max.addFileToLine(done.lineId, pdf('invoice.pdf'), 'receipt');
    await max.markPurchased(done.id);
    await max.markProcessed(done.id);
    // Make it look as the previous version left it: no Quantity or Row type column, and no values in them.
    const lines = site.listByUrlName('PurchaseRequestLines')!;
    lines.fields = lines.fields.filter((f) => !NEW_COLUMNS.includes(f.InternalName));
    for (const item of lines.items.values()) for (const column of NEW_COLUMNS) delete item.fields[column];
    return { site, draft, waiting, submitted, done };
  }

  it('asks Set-up to add exactly the two new columns, adds them, and changes or removes nothing that was stored', async () => {
    const { site } = await previousVersionSite();
    const before = snapshot(site);
    const itemCounts = LISTS.map((n) => site.listByUrlName(n)!.items.size);
    // Until Set-up runs, the app reports the site as not ready: employees see the "not set up yet" notice, nothing breaks.
    const status = await serviceFor(site, MAX).getSetupStatus();
    expect(status.ready).toBe(false);
    expect(status.lists.find((l) => l.key === 'lines')!.missingFields).toEqual(NEW_COLUMNS);
    expect(status.lists.filter((l) => l.key !== 'lines').every((l) => l.missingFields.length === 0)).toBe(true);
    expect((await serviceFor(site, JANE).getSetupStatus()).ready).toBe(false);
    const after = await serviceFor(site, MAX).runSetup(() => undefined);
    expect(after.ready).toBe(true);
    // Every item, every value and every attachment is exactly as it was; nothing was added or removed.
    expect(snapshot(site)).toEqual(before);
    expect(LISTS.map((n) => site.listByUrlName(n)!.items.size)).toEqual(itemCounts);
    // Running Set-up again changes nothing.
    await serviceFor(site, MAX).runSetup(() => undefined);
    expect(snapshot(site)).toEqual(before);
  });

  it('shows every earlier request, row and total unchanged, with quantity 1 and an ordinary row type', async () => {
    const { site, draft, waiting, submitted, done } = await previousVersionSite();
    await serviceFor(site, MAX).runSetup(() => undefined);
    const jane = serviceFor(site, JANE);
    const mine = await jane.listMyRequests();
    expect(mine.map((r) => [r.businessPurpose, r.status]).sort()).toEqual(
      [
        ['Draft from before', 'Draft'],
        ['Waiting from before', 'Awaiting approval'],
        ['Submitted from before', 'Submitted'],
        ['Processed from before', 'Processed']
      ].sort()
    );
    const rows = async (id: number) => (await jane.getRequest(id)).lines;
    expect((await rows(draft.id))[0]).toMatchObject({ vendor: 'Acme Lab Supply', amountCents: 12000, quantity: 1, rowKind: '' });
    expect((await rows(waiting.id))[0]).toMatchObject({ vendor: 'Borealis Optics', amountCents: 64000, quantity: 1, rowKind: '' });
    expect((await rows(submitted.id))[0]).toMatchObject({ vendor: 'Northwind Office Supply', amountCents: 8645, quantity: 1 });
    expect((await rows(done.id))[0]).toMatchObject({ vendor: 'Thorlabs', amountCents: 20000, quantity: 1 });
    // The receipt of the finished request is still there, and still counts.
    expect((await rows(done.id))[0].files.map((f) => f.kind)).toEqual(['receipt']);
    expect((await jane.getRequest(done.id)).request.totalCompanyCents).toBe(20000);
  });

  it('lets every step carry on from where it was, and the new steps work on the old requests', async () => {
    const { site, draft, waiting, submitted } = await previousVersionSite();
    await serviceFor(site, MAX).runSetup(() => undefined);
    const jane = serviceFor(site, JANE);
    const max = serviceFor(site, MAX);
    // The approver approves the request that was waiting, and buys it.
    await max.approveRequest(waiting.id, { note: '', categories: {} });
    await max.addFileToLine(waiting.lineId, pdf('invoice.pdf'), 'receipt');
    expect((await max.markPurchased(waiting.id)).type).toBe('package');
    // The submitted request is processed as before.
    expect((await max.markProcessed(submitted.id)).status).toBe('Processed');
    // The old draft takes a quantity, is sent, and can be unsent (P-050).
    await jane.updateLine(draft.lineId, { quantity: 4 });
    expect((await jane.getRequest(draft.id)).lines[0].quantity).toBe(4);
    await jane.sendForApproval(draft.id, CERTIFICATION);
    expect((await jane.unsendRequest(draft.id)).status).toBe('Draft');
    // The administrator records a new purchase (P-051).
    const mine = await makeRequest(max, 'Recorded after the update', { vendor: 'Staples', cents: 3000 }, 'approver');
    await max.addFileToLine(mine.lineId, pdf('receipt.pdf'), 'receipt');
    expect((await max.recordPurchase(mine.id)).type).toBe('package');
  });
});
