# Policy P4 (Purchasing) and the policy tracker

Drafted 2026-11-24 with Max in the iterative workshop (P-063). Draft R1, not approved, not published.

| File | What it is |
|---|---|
| `P4 Purchasing Policy_DRAFT (R1).docx` | The official Purchasing policy for all employees, on the Clarus Labs Master Template (header, footer, styles and logo are the template's own). Four pages: header table, Purpose, General Provisions, How a Purchase Is Requested, Approval, Employee-Paid Purchases and Reimbursement, Quotes, Receipts Certification and Records, Categories and QuickBooks Accounts, Purchases Paid With Grant Funds, Unallowable Purchases, Roles and Responsibilities, Policy Exceptions, Appendix A (the 13 categories and their QuickBooks accounts). |
| `P4 Purchasing Policy_DRAFT (R1) preview.pdf` | A PDF render of the draft, for reading only. |
| `Clarus Labs Policy Tracker.xlsx` | One register for every Clarus Labs policy. One row for now, P4. P3 (Travel Reimbursement) is added when Max has drafted it. Status list, colors, filters and a live count. |

## Where the content comes from

- The rules are the ones in `docs/POLICY.md` (draft R0, 2026-10-01, P-044), which Max confirmed on 2026-11-24 are unchanged: the approver buys by default, approval at $500 per vendor, the 10% rule, 30 days, equipment over $5,000 on a grant, and the categories. They match `app/src/domain/purchaseRules.ts` (checked 2026-11-24), except two rules the app does not check: the 30-day deadline and the $5,000 grant equipment approval.
- New since R0, stated as the app does it (Max, 2026-11-24): Owners may approve their own request (self-approved), and an Owner may record a purchase they already made (no approval step, no employee certification, a receipt or reason still needed).
- The step-by-step app instructions are not in the policy. They go in the SOP, which comes next.

## Placeholders still to fill (highlighted yellow)

- `[INSERT GO-LIVE DATE.]` the effective date (policy header table and tracker).
- `[INSERT RECORD RETENTION PERIOD.]` (Receipts, Certification and Records).
- Tracker only: `[INSERT NEXT REVIEW DATE.]`, `[INSERT POLICY TAB LINK.]`, `[CONFIRM WHAT P4 SUPERSEDES.]`.

## Before it is published

1. Max reads it and approves it. Remove "(Draft)" from the header document name, set the status in the tracker, and fill the placeholders.
2. Unverified: the federal basis for "equipment over $5,000 per item needs prior written approval from the NSF program officer". It is Max's decision (P-044), kept as decided. Check it against the award terms.
3. The tracker's theme was not replaced with the Clarus theme file (only the Word theme was supplied, and it is the Office default). Colors and Arial are set directly on the cells.
4. Post it on the SharePoint policy tab: Max does this. Nothing was written to SharePoint.

## Template notes

- The template numbers its headings automatically. This policy turns the numbers off on each heading (as the P3 example has none), and refers to sections by name.
- Header document name: "P4 Purchasing Policy (Draft)". Header date: November 24, 2026 (the draft date, not the effective date).
