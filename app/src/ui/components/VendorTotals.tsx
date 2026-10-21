import * as React from 'react';
import { centsToPlain, formatCents } from '../../domain/money';
import { EXTRA_KINDS, ExtraKind, extraChargeOf } from '../../domain/extraCharges';
import { APPROVAL_THRESHOLD_TEXT, QUOTE_THRESHOLD_TEXT } from '../../domain/purchaseRules';
import { BadgeTone } from '../../domain/statuses';
import { BuyerId, PurchaseLine, PurchaseRequest } from '../../domain/types';
import { VENDOR_APPROVAL_LABEL, quoteText, rowsText, vendorRows } from '../vendorRows';
import { Badge, Tag } from './common';

const APPROVAL_TONE: Record<keyof typeof VENDOR_APPROVAL_LABEL, BadgeTone> = {
  notRequired: 'lavender',
  needed: 'amber',
  pending: 'amber',
  approved: 'green',
  changed: 'amber'
};

const EXTRA_LABEL: Record<ExtraKind, string> = { shipping: 'Shipping', tax: 'Tax' };

/**
 * An optional amount box for a vendor's shipping or tax. The amount is read when the box is left or Enter is
 * pressed, not while it is typed, so a half-typed amount never makes a row. Afterwards the box shows what is
 * kept: the amount, or empty.
 */
function ExtraBox(props: { label: string; cents: number | null; disabled: boolean; onCommit: (text: string) => Promise<void> }): React.ReactElement {
  const kept = props.cents === null ? '' : centsToPlain(props.cents);
  const [text, setText] = React.useState(kept);
  const keptNow = React.useRef(kept);
  keptNow.current = kept;
  React.useEffect(() => setText(kept), [kept]);
  const commit = () => {
    if (text.trim() === kept) return;
    void props.onCommit(text).finally(() => setText(keptNow.current));
  };
  return (
    <input
      className="ctx-cell amount ctx-extra-box"
      inputMode="decimal"
      placeholder="0.00"
      aria-label={props.label}
      value={text}
      disabled={props.disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.currentTarget.blur();
      }}
    />
  );
}

/**
 * Each vendor's total in the request, whether it needs approval and a quote,
 * and where it stands (P-015, P-016, P-019). Totals are by vendor within the
 * request, so splitting a purchase across rows does not avoid the threshold.
 * `showApproved` adds the amount the approver approved (administrator page).
 */
export function VendorTotals(props: {
  lines: PurchaseLine[];
  request: Pick<PurchaseRequest, 'status' | 'approval'> & { buyer?: BuyerId };
  showApproved?: boolean;
  showIntro?: boolean;
  /**
   * While the approver buys (P-048): two optional boxes per vendor, Shipping and Tax. A filled box keeps one
   * ordinary row for that vendor; an emptied box removes it. `onSet` resolves when the rows have been changed.
   */
  extras?: { busy: boolean; onSet: (vendorKey: string, kind: ExtraKind, text: string) => Promise<void> };
}): React.ReactElement {
  const rows = vendorRows(props.lines, props.request);
  return (
    <div>
      {props.extras && rows.length > 0 ? (
        <div className="ctx-hint" style={{ marginBottom: 10 }}>
          Type each vendor&apos;s shipping and tax from its receipt in the boxes below. Each makes a row in the grid that you can still change, and the
          vendor&apos;s receipt covers it. Leave a box empty if there is none.
        </div>
      ) : null}
      {props.showIntro ? (
        <div className="ctx-hint" style={{ marginBottom: 10 }}>
          {props.request.buyer === 'approver'
            ? `Every vendor total goes to the approver, whatever the amount. A vendor total of ${QUOTE_THRESHOLD_TEXT} or more needs a quote, or a reason there is none.`
            : `A vendor total of ${APPROVAL_THRESHOLD_TEXT} or more needs approval before you buy, and a quote or a reason.`}
        </div>
      ) : null}
      {rows.length === 0 ? (
        <div className="ctx-hint">Add purchases to see the vendor totals.</div>
      ) : (
        <div className="ctx-table-wrap">
          <table className="ctx-table">
            <thead>
              <tr>
                <th>Vendor</th>
                {props.extras ? EXTRA_KINDS.map((kind) => <th key={kind}>{EXTRA_LABEL[kind]}</th>) : null}
                <th className="num">Total</th>
                {props.showApproved ? <th className="num">Approved</th> : null}
                <th>Approval</th>
                <th>Quote</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.group.key}>
                  <td>
                    <span className="ctx-strong">{r.group.vendor || <span className="ctx-muted">No vendor yet</span>}</span>
                    <div className="ctx-hint">{rowsText(r.rows)}</div>
                  </td>
                  {props.extras
                    ? EXTRA_KINDS.map((kind) => (
                        <td key={kind}>
                          {r.group.key.startsWith('line:') ? null : (
                            <ExtraBox
                              label={`${EXTRA_LABEL[kind]} for ${r.group.vendor}`}
                              cents={extraChargeOf(props.lines, r.group.key, kind).cents}
                              disabled={props.extras!.busy}
                              onCommit={(text) => props.extras!.onSet(r.group.key, kind, text)}
                            />
                          )}
                        </td>
                      ))
                    : null}
                  <td className="num">{formatCents(r.group.totalCents)}</td>
                  {props.showApproved ? (
                    <td className="num">{r.approvedCents === null ? <span className="ctx-muted">-</span> : formatCents(r.approvedCents)}</td>
                  ) : null}
                  <td>
                    <Badge tone={APPROVAL_TONE[r.approval]}>{VENDOR_APPROVAL_LABEL[r.approval]}</Badge>
                    {r.boughtBefore ? (
                      <>
                        {' '}
                        <Tag>Bought before approval</Tag>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {r.quote.kind === 'notNeeded' ? (
                      <span className="ctx-muted" title="No quote is needed">
                        -
                      </span>
                    ) : r.quote.kind === 'missing' ? (
                      <Badge tone="amber">{quoteText(r.quote)}</Badge>
                    ) : (
                      quoteText(r.quote)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
