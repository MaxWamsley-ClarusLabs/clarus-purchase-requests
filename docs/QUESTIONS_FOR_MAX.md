# Questions for Max

Written during the overnight build (2026-09-30). Every choice Claude made where your prompt was silent is listed here and recorded in `docs/DECISIONS.md` as "Provisional (Claude, awaiting Max)". Each is built as recommended and stays in force until you answer. You can answer with a number and a word, for example "3: keep" or "2: option B".

From your next message the normal rule applies again: Claude pauses and asks, at most five numbered questions at a time. So these are listed in order of how much they matter, and the first five are the ones to answer first.

**Answer these five first**

| # | Question | Why it is first |
|---|---|---|
| 1 | Which QuickBooks account goes with each category? | The CSV suggests accounts that Claude could not check |
| 2 | Is "$500 or more" right for the quote rule, and is the old form's $100 retired? | The attached form says something different |
| 3 | Is "send for approval first, then submit" right for a purchase already made? | It decides how an after-the-fact purchase is handled |
| 4 | Keep the rule that a vendor total more than 10% above what was approved needs approval again? | Claude's own rule; a guess |
| 5 | Is it right that the site Owners approve, and that an Owner may approve their own request? | Decides who gets the email and what "approved" means |

---

## 1. QuickBooks accounts for the eight categories (Unverified, to confirm with Max)

- **Built:** a suggested account name for each category in the CSV, without account numbers, because Claude could not look up your chart of accounts (the QuickBooks connector is not used, and the travel repository lists travel accounts only).

  | Category | Suggested account (Unverified) |
  |---|---|
  | R&D Materials & Supplies / Equipment | R&D Materials and Supplies |
  | Advertising/Marketing/Website | Advertising and Marketing |
  | Computer, H/W & S/W Supplies | Computer and Software |
  | Office Supplies | Office Supplies |
  | Training and Education | Training and Education |
  | Shipping/Postage | Shipping and Postage |
  | Business Insurance | Insurance |
  | Other | (none; the administrator decides) |

- **Options:** A. Give Claude the real account names or numbers for each category. B. Leave the column blank until the policy stage. C. Keep these names as plain hints.
- **Recommendation:** A. It is the only way the CSV column becomes useful. In the meantime C is harmless, because the administrator decides the account, as in travel.
- **If you choose differently:** `CATEGORIES[].suggestedAccount` and `QUICKBOOKS_MAPPING_STATUS` in `app/src/domain/purchaseRules.ts` (P-025). No other file changes.

## 2. The quote rule, and the attached form's older numbers (P-015, P-005)

- **Built:** a vendor total of **$500 or more** needs a quote or a written no-quote reason before the request can be sent for approval. Approval is also at $500 or more (your decision).
- **What the attached form says:** purchases of **$100 or more** need supervisor approval, and purchases **over $500** need a quote or a written no-quote justification. That is the old P4 wording. You decided $500 for approval, and the app does not use the $100. The form's text is not changed by this build.
- **Options:** A. Quote at "$500 or more" (built). B. Quote at "over $500", as the form says (the difference is a purchase of exactly $500.00). C. A different quote threshold, for example $1,000. D. No quote rule.
- **Recommendation:** A, for one number to explain. Retire the form's $100 and "over $500" in the policy stage.
- **If you choose differently:** `QUOTE_THRESHOLD_CENTS` and the comparison in `app/src/domain/purchaseRules.ts`; wording in `messages.ts`.

## 3. A purchase already made without approval (P-017)

- **Built:** when a request is sent for approval, a vendor total of $500 or more is flagged **Bought before approval** if any of its lines is dated before the day it is sent, or already has a receipt or invoice attached. The request still goes to the approver first. The flag stays on the request. The administrator sees it in the email and in a CSV column. After the approval, the employee submits for processing as usual.
- **Options:** A. As built: flag, approve, then submit (two steps; the folder and CSV are built once, with the approval in them). B. Let the employee submit straight to processing, flagged, with the approval still to come (one step, but the CSV and folder would be made before the approval exists and would say "pending"). C. Ask the employee to tick "already bought" instead of working it out from dates and receipts.
- **Recommendation:** A.
- **If you choose differently:** `isAlreadyBought` and `flagBoughtBefore` in `purchaseRules.ts` (C); the send and submit actions in both data services and the Review step (B).

## 4. Approval covers what the approver saw (P-019)

- **Built:** the approver approves each vendor total at the amount shown. Later, the employee may change amounts (real prices differ). A vendor total that is more than **10%** above its approved amount, or a new vendor total of $500 or more, needs approval again, and Submit says so. Lower amounts never need approval again.
- **Options:** A. 10% allowance (built; the number is a guess). B. No allowance (any increase needs approval). C. No check after approval.
- **Recommendation:** A, with your number in place of mine.
- **If you choose differently:** `OVERRUN_TOLERANCE_PERCENT` in `purchaseRules.ts` (0 for B). For C, remove `approvalCoverage` from `validateRequest`.

## 5. Who approves (P-018, P-020)

- **Built:** approvers are the site Owners (people with "Manage web site"), the same test the travel app uses for administrators. The approval email goes to the Owners' addresses as they are when you make the flow package on Set-up (fallback: your own address). An Owner who is also the requester can approve their own request; the record, email and CSV say "self-approved". Employees cannot withdraw a request that is awaiting approval.
- **Options:** A. As built. B. A separate approver list, kept on the site (needs a fourth list or a setting in the code). C. Block self-approval (you could never approve your own purchases while you are the only Owner). D. Add a Withdraw button for employees.
- **Recommendation:** A now; add B when a second approver is named.
- **If you choose differently:** `requireAdmin` and `approveRequest` in `SharePointDataService.ts` and `MockDataService.ts`; `approverEmails` in `app/src/export/flowPackage.ts`.

## 6. How thresholds count (P-016)

- **Built:** by the total from the same vendor within one request, not by line. A request has one business purpose and one project or grant code, so "same vendor for the same purpose" is "same vendor in the request". Vendor names match ignoring capitals, spaces and punctuation.
- **Options:** A. Within a request (built; your prompt says "in a request"). B. Also across an employee's other requests in a period, for example 30 days, to catch a purchase split into several requests. C. Per line.
- **Recommendation:** A now. Consider B at the policy stage, together with a period.
- **If you choose differently:** `vendorGroups` in `purchaseRules.ts`; B also needs the employee's other requests loaded (`getOwnerOtherLines` already loads their other lines).

## 7. Approval email is a branch of the same flow (P-018)

- **Built:** one flow. The app records a request for approval as a Purchase Submissions item of type "Approval request"; the flow emails the approvers and marks it Packaged. Processing is unchanged.
- **Options:** A. As built. B. A second flow (a second import and a second thing to keep turned on). C. The Approvals connector.
- **Recommendation:** A. See the decision for the reasons.
- **If you choose differently:** `app/src/export/flowPackage.ts`, `flow/FLOW.md`.

## 8. Quotes and receipts are marked per file (P-021)

- **Built:** each attached file is a receipt (invoices count) or a quote. The drop box has a switch; the row menu has "Attach a quote" and "Attach a receipt or invoice". A quote never counts as the receipt. In the folder: `R01_...` and `Q01_...`. The receipt reader reads receipt files only.
- **Options:** A. As built. B. One untyped list of files (simpler screen, but a quote could pass for a receipt).
- **Recommendation:** A.
- **If you choose differently:** `ReceiptFile.kind`, `naming.ts`, `mapping.ts`, the grid.

## 9. Header fields (P-022)

- **Built:** the business purpose is one line and is also the request's name; the project or grant code is its own optional field with a quick pick (no default); department is required, suggested from earlier requests and filled in from the employee's latest request; purchase dates come from the lines; the date submitted is set at Submit.
- **Options:** A. As built. B. A separate short request name. C. A fixed list of departments (give Claude the list).
- **Recommendation:** A now; C if you give the list.
- **If you choose differently:** `docs/DATA_MODEL.md`, `purchaseRules.ts` (`PROJECT_QUICK_PICKS`, and a `DEPARTMENTS` list for C), `validation.ts`.

## 10. Who paid defaults (P-023)

- **Built:** Company or Employee. The first row starts as Company; each new row copies the row above; vendor memory remembers who paid. The travel CSV's "Suggested payment account" column is dropped.
- **Options:** A. As built. B. Start as Employee. C. No default.
- **Recommendation:** A (company card is the common case in travel, 79% to 95%). Tell Claude if purchases differ.
- **If you choose differently:** `FIRST_ROW_PAID_BY` in `defaults.ts`.

## 11. Category details (P-024)

- **Built:** Other needs a short description of the category. The CSV shows who confirmed each category (the approver when approving, or the administrator later), empty if only the employee suggested it. An administrator's change after submission is saved in the app; the CSV in the folder keeps the category as submitted.
- **Options:** A. As built. B. Rewrite the CSV after processing (a second write into Accounting). C. No record of who confirmed.
- **Recommendation:** A.
- **If you choose differently:** `confirmCategories` in the data services and `csv.ts`.

## 12. Folder and file names (P-026)

- **Built:** `YYYY-MM-DD_Employee-Name_Business-Purpose_PR-0042` using the earliest purchase date (so the date shows the filing year); `_R2` for a resubmission; CSV `PR-0042_Purchases.csv`. The 27 CSV columns are listed in `docs/STRATEGY.md` section 7.
- **Options:** A. As built. B. Date the folder by the submission date.
- **Recommendation:** A.
- **If you choose differently:** `naming.ts`, `csv.ts`.

## 13. Editing and locking (P-027)

- **Built:** the employee can edit a request that is Draft, Returned or Approved. Awaiting approval, Submitted and Processed are locked. Returned after processing keeps its approval if nothing changed beyond question 4's allowance.
- **Options:** A. As built. B. Lock after approval (receipts could not be attached).
- **Recommendation:** A.
- **If you choose differently:** `isEditable` in `statuses.ts`.

## 14. Certification only at Submit (P-028)

- **Built:** the certification sentence (yours, exact) is ticked at Submit, not when sending for approval.
- **Options:** A. As built. B. Also at sending for approval.
- **Recommendation:** A. The sentence says the purchases "have not been reimbursed elsewhere", which is about what was actually bought.
- **If you choose differently:** the send dialog in `ReportWorkspace.tsx` and `sendForApproval` in the data services.

## 15. An employee could mark their own request Approved in SharePoint (P-029)

- **Built:** as in travel (D-002), employees can edit their own list items directly. The version history records it, and the email and CSV name the approver and the time. No extra check.
- **Options:** A. Accept, as in travel. B. Store approvals where employees cannot write (another list and a second permission model), and have the app check them.
- **Recommendation:** A for the pilot; look again at the security review.
- **If you choose differently:** a new list in `schema.ts` and the data services.

## 15a. Small choices, for information (P-030, P-031)

- Approval emails that were not sent within 30 minutes, or failed, show under Needs attention with Retry. The sidebar counts Approvals and Requests to process.
- The preview uses Jane Doe and Sam Lee as employees and Max Wamsley as administrator and approver, with made-up vendors and generated sample receipts. The name Max Wamsley was already in the travel app's sample data; no real address or data is used.
- Not built, on purpose: a late-submission warning, a "future purchase date" warning, withdrawing a request, counting a vendor across requests, a separate approver role, emails to the employee.

## 16. Things the build could not check

- Whether the Owners' addresses can be read by the Set-up page with `web/AssociatedOwnerGroup/users` (Unverified). If not, the approval email goes to your own address, and the Set-up page says so.
- Whether the flow's new approval branch imports and runs as written (Unverified). Tested at the checkpoint, `docs/CHECKPOINT.md`, step 15 onward.
- Everything Microsoft-side from the travel strategy's evidence table, which was not re-checked.
