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

- **Built:** a suggested account name for each category in the CSV, without account numbers, under a column header that says "Suggested QuickBooks account (Unverified, to confirm with Max)", because Claude could not look up your chart of accounts (the QuickBooks connector is not used, and the travel repository lists travel accounts only).

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

- **Built:** when a request is sent for approval, a vendor total of $500 or more is flagged **Bought before approval** if any of its lines is dated before the day it is sent, or already has a receipt or invoice attached. The request still goes to the approver first. The flag stays on the request. The administrator sees it in the email and in a CSV column. After the approval, the employee submits for processing as usual. A flag, once set, stays in later rounds. If the request is sent again after an approval (a vendor total rose past the allowance), a vendor total the approval still covers is not newly flagged, because it was approved before it was bought. (That second-send rule is Claude's; your prompt did not cover it.)
- **Options:** A. As built: flag, approve, then submit (two steps; the folder and CSV are built once, with the approval in them). B. Let the employee submit straight to processing, flagged, with the approval still to come (one step, but the CSV and folder would be made before the approval exists and would say "pending"). C. Ask the employee to tick "already bought" instead of working it out from dates and receipts.
- **Recommendation:** A.
- **If you choose differently:** `isAlreadyBought` and `groupsForApproval` in `purchaseRules.ts` (C); the send and submit actions in both data services and the Review step (B).

## 4. Approval covers what the approver saw (P-019)

- **Built:** the approver approves each vendor total at the amount shown. Later, the employee may change amounts (real prices differ). A vendor total that is more than **10%** above its approved amount, or a new vendor total of $500 or more, needs approval again, and Submit says so. Lower amounts never need approval again.
- **Options:** A. 10% allowance (built; the number is a guess). B. No allowance (any increase needs approval). C. No check after approval.
- **Recommendation:** A, with your number in place of mine.
- **If you choose differently:** `OVERRUN_TOLERANCE_PERCENT` in `purchaseRules.ts` (0 for B). For C, remove the check of `approvalState` in `prepareSubmission` (`app/src/export/submission.ts`).

## 5. Who approves (P-018, P-020)

- **Built:** approvers are the site Owners (people with "Manage web site"), the same test the travel app uses for administrators. The approval email goes to the Owners' addresses as they are when you make the flow package on Set-up (fallback: your own address). An Owner who is also the requester can approve their own request; the record, email and CSV say "self-approved". Employees cannot withdraw a request that is awaiting approval.
- **Options:** A. As built. B. A separate approver list, kept on the site (needs a fourth list or a setting in the code). C. Block self-approval (you could never approve your own purchases while you are the only Owner). D. Add a Withdraw button for employees.
- **Recommendation:** A now; add B when a second approver is named.
- **If you choose differently:** `requireAdmin` and `approveRequest` in `SharePointDataService.ts` and `MockDataService.ts`; `approverEmails` in `app/src/export/flowPackage.ts`.

## 6. How thresholds count (P-016)

- **Built:** by the total from the same vendor within one request, not by line. A request has one business purpose and one project or grant code, so "same vendor for the same purpose" is "same vendor in the request". Vendor names match ignoring capitals, accents, spaces and punctuation, in any alphabet ("Digi-Key" and "DigiKey" are one vendor; "Amazon" and "Amazon.com" are two).
- **Options:** A. Within a request (built; your prompt says "in a request"). B. Also across an employee's other requests in a period, for example 30 days, to catch a purchase split into several requests. C. Per line.
- **Recommendation:** A now. Consider B at the policy stage, together with a period.
- **If you choose differently:** `vendorKey` and `vendorGroups` in `purchaseRules.ts`; B also needs the employee's other requests loaded (`getOwnerOtherLines` already loads their other lines).

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

- **Built:** `YYYY-MM-DD_Employee-Name_Business-Purpose_PR-0042` using the earliest purchase date (so the date shows the filing year); `_R2` for a resubmission; CSV `PR-0042_Purchases.csv`. The 28 CSV columns are listed in `docs/STRATEGY.md` section 7; the suggested-account column's header carries the words "Unverified, to confirm with Max".
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
- **If you choose differently:** the send dialog in `RequestWorkspace.tsx` and `sendForApproval` in the data services.

## 15. An employee could mark their own request Approved in SharePoint (P-029)

- **Built:** as in travel (D-002), employees can edit their own list items directly. The version history records it, and the email and CSV name the approver and the time. No extra check.
- **Options:** A. Accept, as in travel. B. Store approvals where employees cannot write (another list and a second permission model), and have the app check them.
- **Recommendation:** A for the pilot; look again at the security review.
- **If you choose differently:** a new list in `schema.ts` and the data services.

## 16. Needs attention covers approval emails, and Retry is limited (P-030)

- **Built:** an approval email that was not sent within 30 minutes, or failed, shows under Needs attention like a failed package. Only the newest submission of a request that is still at that step is listed. The sidebar counts Approvals, Requests to process and Needs attention. Retry works only on a failed or stuck submission that is the newest of its kind, while the request is Awaiting approval (email) or Submitted (package).
- **Options:** A. As built. B. Leave approval emails unmonitored (an unnoticed failed email would stall a purchase). C. List every failed submission for ever (old failures would bury the current ones).
- **Recommendation:** A.
- **If you choose differently:** `adminData.ts` (`stuckSubmissions`), `retryRefusal` in `serviceRules.ts`.

## 17. The screens (P-032)

- **Built:** a request is made in three steps (Request details, Purchases, Review and submit); the Purchases step has a Vendor totals table; the approver's page has category drop-downs, an Approve dialog (optional note), a Return dialog (the note is required), and file names that open the quote or receipt. The screenshots are in `docs/prototype/`, with what each one shows.
- **Options:** A. As built. B. One long page. C. Approving each line separately (you decided approval is by request, and thresholds count by vendor total, so each vendor total, not each line, is what is approved).
- **Recommendation:** A. Tell Claude what looks wrong in the screenshots; a screen change is cheap now and dearer after the pilot.
- **If you choose differently:** `app/src/ui/`.

## 18. Preview data is fictional (P-031)

- **Built:** the preview uses Jane Doe and Sam Lee as employees and Max Wamsley as administrator and approver, with made-up vendors and generated sample receipts stamped "synthetic sample for testing". The name Max Wamsley was already in the travel app's sample data; no real address or data is used.
- **Options:** A. As built. B. Replace the name with a fictional administrator.
- **Recommendation:** A, unless you prefer B.
- **If you choose differently:** `app/src/data/mock/sampleData.ts`.

## 19. An employee could make the flow send an approval email (P-033)

- **Built:** employees can edit their own list items directly, so an employee could create an approval request item with any subject and summary, and the flow would email the Owners from your mailbox. The text is escaped and the recipients and link are fixed, so it cannot hold markup or reach anyone else, and it cannot approve anything. It is a misleading-message risk.
- **Options:** A. Accept for the pilot (as built). B. The flow writes the subject from fixed columns and adds a fixed line saying the summary was written by the requester's app session. C. Keep approval requests where employees cannot write (a fourth list).
- **Recommendation:** A for the pilot; B at the security review.
- **If you choose differently:** the approval branch in `app/src/export/flowPackage.ts`, `email.ts`.

## 20. Integrity checks the app makes (P-034)

- **Built:** Approve is refused if the vendor totals no longer match what was sent; a row or submission counts for a request only if the request's owner created it; Retry is limited; a row holds its own receipt or points at another row's, not both; a file with no recorded kind counts as a quote; the request number comes from the item's ID. Employees can still edit their own items directly in SharePoint, so these catch mistakes and make dishonest edits harder, not impossible.
- **Options:** A. As built. B. Add a second list employees cannot write to for approvals (P-029's option B).
- **Recommendation:** A for the pilot; look at B at the security review.
- **If you choose differently:** `serviceRules.ts`, `SharePointDataService.ts`, `MockDataService.ts`.

## 21. Typing, pasting and saving limits (P-035)

- **Built:** an amount takes a comma only as a thousands separator, so "12,50" is refused rather than read as $1,250.00; amounts above $10,000,000.00 are refused; dates must be real dates in 2000 to 2099; pasting from a spreadsheet understands quoted cells and dates like 10/14/2026, and says what it skipped; text is cut at 255 characters; changes save half a second after the last keystroke, and the browser asks before you leave a page with something unsaved.
- **Options:** A. As built. B. Read "12,50" as 12.50 (ambiguous with thousands). C. Remove the $10,000,000.00 limit. D. Limit dates to a year around today.
- **Recommendation:** A.
- **If you choose differently:** `money.ts`, `dates.ts`, `app/src/ui/pasteParse.ts`.

## 22. After approval, only vendor amounts are re-checked (P-036)

- **Built:** the approval records each vendor total. After approval, the employee can still change the business purpose, the project or grant code and the suggested categories, delete rows, and remove a quote, without sending the request back for approval. Reviewers found this gap; your prompt did not cover it.
- **Options:** A. As built. B. Record the business purpose and project or grant code with the approval, and warn the administrator in the submission email if either changed (a typo fix would also warn). C. Lock the request once approved (receipts and real prices could not be attached).
- **Recommendation:** B.
- **If you choose differently:** `ApprovalRecord` in `types.ts`, `approvalState` in `purchaseRules.ts`, `submission.ts`, `email.ts`.

## 23. Things the build could not check

- Whether the Owners' addresses can be read by the Set-up page with `web/AssociatedOwnerGroup/users` (Unverified). If not, the approval email goes to your own address, and the Set-up page says so ("your own address, because the site Owners could not be read"). Checkpoint step 13 shows which happened, and step 33 tests whether an employee can read the Owners group for the Approver line. On a site connected to a Microsoft 365 group, the Owners group may hold that group as one entry, so the package would fall back to your address (Unverified).
- Whether the flow's new approval branch imports and runs as written (Unverified). Tested at the checkpoint, `docs/CHECKPOINT.md`: the import and turning it on in steps 14 and 15, the branch and the approval email in steps 21 to 31 (several addresses in one message only if a second Owner was added in step 3). The failure scope is not tested at the checkpoint (step 34 explains why) and stays Unverified.
- Whether SharePoint accepts clearing a Person column and the "Returned at" choice, which the app does when an approver returns a request at the approval step (Unverified; a first send no longer does it, P-034).
- Whether the Owners can open a row's attachments in the app, which the approver's file preview relies on (Unverified).
- Everything Microsoft-side from the travel strategy's evidence table, which was not re-checked.

## Not built, on purpose

A late-submission warning, a "future purchase date" warning, withdrawing a request, counting a vendor across requests, a separate approver role, and emails to the employee.
