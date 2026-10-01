# Questions for Max

Written during the overnight build (2026-09-30). Every choice Claude made where your prompt was silent is listed here and recorded in `docs/DECISIONS.md` as "Provisional (Claude, awaiting Max)". Each is built as recommended and stays in force until you answer. You can answer with a number and a word, for example "3: keep" or "2: option B".

From your next message the normal rule applies again: Claude pauses and asks, at most five numbered questions at a time. So these are listed in order of how much they matter, and the first five are the ones to answer first.

**Answered by Max on 2026-10-01:** questions 2, 4 and 5: yes. Question 3: "do whatever you think", so the recommendation stands. Question 1: answered with the account list (the categories are now the QuickBooks accounts, P-038). Questions 24 (do the recommendation), 25 (A, and the employee also gives the item's web page), 26 (A), 27 (yes), 28 (A) and 29 (A): the approver buys by default, and the approver-buys build is on the branch (P-037 to P-042). **New and open: questions 30 to 32**, at the end of this file. Nothing else in the file is waiting on Max except the provisional choices, which stay in force until he answers.

**The first five, as asked**

| # | Question | Why it is first |
|---|---|---|
| 1 | Which QuickBooks account goes with each category? | **Answered (2026-10-01).** Max supplied the accounts, four corrections and four more categories: 13 categories, each a QuickBooks account (P-038) |
| 2 | Is "$500 or more" right for the quote rule, and is the old form's $100 retired? | **Answered: yes.** To go in the new SOP |
| 3 | Is "send for approval first, then submit" right for a purchase already made? | **Answered: do whatever Claude thinks.** Option A stands |
| 4 | Keep the rule that a vendor total more than 10% above what was approved needs approval again? | **Answered: yes** |
| 5 | Is it right that the site Owners approve, and that an Owner may approve their own request? | **Answered: yes** |

---

## 1. QuickBooks accounts for the categories (answered, P-038)

- **Max, 2026-10-01:** he had already read `Intuit_Account List.xlsx` (the May 1, 2026 export) in another conversation, and gave the accounts in his message: the account number and exact name for each category, four corrections to the first build's suggested names, and four more categories (Dues and Subscriptions, Telephone/Internet, Repairs & maintenance, Professional Services). He also asked to split "R&D Materials & Supplies / Equipment" into two. Claude did not open the file; the app's numbers and names are from his message.
- **Built:** 13 categories, each one a QuickBooks account (P-038), in one table in `purchaseRules.ts`, labelled "from the May 1, 2026 account list". The CSV has one column, "QuickBooks account", with the number and exact name. Equipment (6175, expensed or capitalized to 1415 Fixed Assets:Equipment) and Other (no account) show "Administrator decides", and Mark processed is refused for a row in one of them that nobody has confirmed. There is no class column.

  | Category | QuickBooks account |
  |---|---|
  | R&D Materials & Supplies | 6182 R&D Materials & Supplies |
  | Equipment | 6175 Equipment (administrator decides: expense it, or capitalize it to 1415 Fixed Assets:Equipment) |
  | Advertising/Marketing/Website | 6500 Advertising/Marketing/Website |
  | Computer, H/W & S/W Supplies | 6178 Computer, H/W & S/W Supplies |
  | Office Supplies | 6180 Office Supplies |
  | Training and Education | 6155 Training and Education |
  | Shipping/Postage | 6184 Shipping/Postage |
  | Business Insurance | 6215 Business Insurance |
  | Dues and Subscriptions | 6150 Dues and Subscriptions |
  | Telephone/Internet | 6185 Telephone/Internet |
  | Repairs & maintenance | 6170 Repairs & maintenance |
  | Professional Services | 6050 Professional Services (the administrator picks the specific account in QuickBooks) |
  | Other | Administrator decides |

- **Still to do:** export the account list again and compare it with `purchaseRules.ts` before go-live (`docs/CHECKPOINT.md` step 35). Where Equipment is capitalized rather than expensed waits for the purchasing policy (the last stage).
- **If something is wrong:** `CATEGORIES[]` and `QUICKBOOKS_MAPPING_STATUS` in `app/src/domain/purchaseRules.ts` (P-038). No other file changes.

## 2. The quote rule, and the attached form's older numbers (P-015, P-005)

- **Answered (Max, 2026-10-01): yes.** Quote at "$500 or more", and the form's $100 and "over $500" are retired. It goes in the new SOP (`docs/SOP.md`, "Rules confirmed by Max") and in the purchasing policy at the last stage.

- **Built:** a vendor total of **$500 or more** needs a quote or a written no-quote reason before the request can be sent for approval. Approval is also at $500 or more (your decision).
- **What the attached form says:** purchases of **$100 or more** need supervisor approval, and purchases **over $500** need a quote or a written no-quote justification. That is the old P4 wording. You decided $500 for approval, and the app does not use the $100. The form's text is not changed by this build.
- **Options:** A. Quote at "$500 or more" (built). B. Quote at "over $500", as the form says (the difference is a purchase of exactly $500.00). C. A different quote threshold, for example $1,000. D. No quote rule.
- **Recommendation:** A, for one number to explain. Retire the form's $100 and "over $500" in the policy stage.
- **If you choose differently:** `QUOTE_THRESHOLD_CENTS` and the comparison in `app/src/domain/purchaseRules.ts`; wording in `messages.ts`.

## 3. A purchase already made without approval (P-017)

- **Answered (Max, 2026-10-01): "do whatever you think".** Claude's recommendation, option A, stands. With the approver buying most purchases (question 24), this mostly concerns the few an employee makes for themselves.

- **Built:** when a request is sent for approval, a vendor total of $500 or more is flagged **Bought before approval** if any of its lines is dated before the day it is sent, or already has a receipt or invoice attached. The request still goes to the approver first. The flag stays on the request. The administrator sees it in the email and in a CSV column. After the approval, the employee submits for processing as usual. A flag, once set, stays in later rounds. If the request is sent again after an approval (a vendor total rose past the allowance), a vendor total an approval still covers, including an approval from an earlier round, is not newly flagged, because it was approved before it was bought. (That second-send rule is Claude's; your prompt did not cover it.)
- **Options:** A. As built: flag, approve, then submit (two steps; the folder and CSV are built once, with the approval in them). B. Let the employee submit straight to processing, flagged, with the approval still to come (one step, but the CSV and folder would be made before the approval exists and would say "pending"). C. Ask the employee to tick "already bought" instead of working it out from dates and receipts.
- **Recommendation:** A.
- **If you choose differently:** `isAlreadyBought` and `groupsForApproval` in `purchaseRules.ts` (C); the send and submit actions in both data services and the Review step (B).

## 4. Approval covers what the approver saw (P-019)

- **Answered (Max, 2026-10-01): yes.** Option A, with 10%.

- **Built:** the approver approves each vendor total at the amount shown. Later, the employee may change amounts (real prices differ). A vendor total that is more than **10%** above its approved amount, or a new vendor total of $500 or more, needs approval again, and Submit says so. Lower amounts never need approval again.
- **Options:** A. 10% allowance (built; the number is a guess). B. No allowance (any increase needs approval). C. No check after approval.
- **Recommendation:** A, with your number in place of mine.
- **If you choose differently:** `OVERRUN_TOLERANCE_PERCENT` in `purchaseRules.ts` (0 for B). For C, change `approvalCoverage` and `approvalState` in `purchaseRules.ts`; `prepareSubmission` and `prepareApprovalRequest` (`app/src/export/submission.ts`) and the Review step follow.

## 5. Who approves (P-018, P-020)

- **Answered (Max, 2026-10-01): yes.** Option A: the site Owners approve, and an Owner may approve their own request.

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
- **If you choose differently:** `AttachedFile.kind` in `types.ts`, `naming.ts`, `mapping.ts`, the grid.

## 9. Header fields (P-022)

- **Built:** the business purpose is one line and is also the request's name; the project or grant code is its own optional field with a quick pick (no default); department is required, suggested from earlier requests and filled in from the employee's latest request; purchase dates come from the lines; the date submitted is set at Submit.
- **Options:** A. As built. B. A separate short request name. C. A fixed list of departments (give Claude the list).
- **Recommendation:** A now; C if you give the list.
- **If you choose differently:** `docs/DATA_MODEL.md`, `purchaseRules.ts` (`PROJECT_QUICK_PICKS`, and a `DEPARTMENTS` list for C), `validation.ts`.

## 10. Who paid defaults (P-023)

- **Built:** Company or Employee, asked only when the employee buys it. The first row starts as Company; each new row copies the row above; vendor memory remembers who paid. When the approver buys, nobody is asked: the company pays every row (P-037). The travel CSV's "Suggested payment account" column is dropped.
- **Options:** A. As built. B. Start as Employee. C. No default.
- **Recommendation:** A (company card is the common case in travel, 79% to 95%). Tell Claude if purchases differ.
- **If you choose differently:** `FIRST_ROW_PAID_BY` in `defaults.ts`.

## 11. Category details (P-024)

- **Built:** Other needs a short description of the category. The CSV shows who confirmed each category (the approver when approving, or the administrator later), empty if only the employee suggested it. An administrator's change after submission is saved in the app; the CSV in the folder keeps the category as submitted.
- **Options:** A. As built. B. Rewrite the CSV after processing (a second write into Accounting). C. No record of who confirmed.
- **Recommendation:** A.
- **If you choose differently:** `confirmCategories` in the data services and `csv.ts`.

## 12. Folder and file names (P-026)

- **Built:** `YYYY-MM-DD_Employee-Name_Business-Purpose_PR-0042` using the earliest purchase date (so the date shows the filing year); `_R2` for a resubmission; CSV `PR-0042_Purchases.csv`. The 31 CSV columns are listed in `docs/STRATEGY.md` section 7; the account column is "QuickBooks account" (P-038).
- **Options:** A. As built. B. Date the folder by the submission date.
- **Recommendation:** A.
- **If you choose differently:** `naming.ts`, `csv.ts`.

## 13. Editing and locking (P-027)

- **Built:** the employee can edit a request that is Draft or Returned, or Approved when the employee buys it. Awaiting approval, Submitted and Processed are locked, and so is an Approved request the approver buys, because it is the approver's to change (P-040). Returned after processing keeps its approval if nothing changed beyond question 4's allowance.
- **Options:** A. As built. B. Lock after approval (receipts could not be attached).
- **Recommendation:** A.
- **If you choose differently:** `isEditable` in `statuses.ts`.

## 14. Certification only at Submit (P-028)

- **Built:** the certification sentence (yours, exact) is ticked at Submit when the employee buys, and, when the approver buys, by the employee when sending the request (question 26, P-041). It is not ticked when an employee-bought request is sent for approval.
- **Options:** A. As built. B. Also at sending for approval.
- **Recommendation:** A. The sentence says the purchases "have not been reimbursed elsewhere", which is about what was actually bought.
- **If you choose differently:** the send dialog in `RequestWorkspace.tsx` and `sendForApproval` in the data services.

## 15. An employee could mark their own request Approved in SharePoint (P-029)

- **Built:** as in travel (D-002), employees can edit their own list items directly. The version history records it, and the email and CSV name the approver and the time. No extra check.
- **Options:** A. Accept, as in travel. B. Store approvals where employees cannot write (another list and a second permission model), and have the app check them.
- **Recommendation:** A for the pilot; look again at the security review.
- **If you choose differently:** a new list in `schema.ts` and the data services.

## 16. Needs attention covers approval emails, and Retry is limited (P-030)

- **Built:** an approval email that was not sent within 30 minutes, or failed, shows under Needs attention like a failed package. Only the newest submission of a request that is still at that step is listed. The sidebar counts Approvals, Requests to process and Needs attention. Retry works only on a failed or stuck submission (no change for 30 minutes) that is the newest of its kind, while the request is Awaiting approval (email) or Submitted (package), and the request page shows the button exactly then.
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

- **Built:** an amount takes a comma only as a thousands separator, so "12,50" is refused rather than read as $1,250.00; amounts above $10,000,000.00 are refused; dates must be real dates in 2000 to 2099; pasting from a spreadsheet understands quoted cells and dates like 10/14/2026, and says what it skipped; text is cut at 255 characters; changes save half a second after the last keystroke, one after another, and Send for approval and Submit wait for them; the browser asks before you leave a page with something unsaved (leaving at once can still lose the last characters).
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
- Whether SharePoint accepts the approver adding rows, files and the package to an employee's request (the approver's account creates items that count for the employee's request, P-042), and whether it then hides those rows from the employee as expected (question 30). Unverified; checkpoint step 33, Checks 7 and 8.
- Everything Microsoft-side from the travel strategy's evidence table, which was not re-checked.

## 24. The approver buys most purchases: how should the app work? (answered 2026-10-01, built: P-037)

- **Answered (Max, 2026-10-01): do the recommendation.** He also wrote: "this process is correct (the employee enters what to buy ..., and a quote at $500 or more. Every such request goes to the approver, whatever the amount ... The approver approves, buys, corrects the actual amounts, attaches the receipt, and chooses Mark purchased.)" Built as described below, with the details in P-037 and P-042.

- **From Max:** about 95% of purchases will be bought by the person who approves the request. The employee submits a purchase request and the approver buys it. Make that the default if possible.
- **The first build** assumed the employee buys after approval, attaches the receipt and submits. The approver could not edit rows or attach files, and an approval was needed only at $500 or more.
- **Recommendation (needs approval), per request:**
  1. A choice on Request details, "Who buys this?", with **The approver buys it** as the default and **I will buy it myself** as the other.
  2. If the approver buys: the employee enters what to buy (vendor, what and why, estimated amount, category, and a quote at $500 or more). No receipt is asked for, and "Who paid" is not asked (it is the company).
  3. Every such request goes to the approver, whatever the amount, because the approver has to act on it. The $500 threshold, the 10% rule and the "Bought before approval" flag then apply only to requests the employee buys themselves, which stay exactly as they are today. The quote rule at $500 stays for both.
  4. The approver approves (confirming categories), buys, then on the request page corrects the actual amounts and vendor, attaches the receipt or invoice, and chooses "Mark purchased". The app then builds the folder (receipt copies, quote copies, CSV) for processing, as it does today after a submit.
- **What it needs built:** a "Who buys this?" field and its default; approver editing of rows and attaching of files (today only categories can be changed); the integrity rule in P-034 widened so that rows and files the recorded approver adds count; wording for the statuses; CSV and email text; the Instructions, SOP and checkpoint steps.
- **Options:** A. As recommended. B. A setting for the whole site instead of a choice on each request. C. Keep today's flow and treat approver purchases as an exception.
- **Recommendation:** A. A per-request choice keeps the 5% where an employee buys working as today, and the default means the 95% case needs no extra click.
- **If you choose differently:** `app/src/ui/pages/RequestWorkspace.tsx`, `AdminRequestPage.tsx`, both data services, `purchaseRules.ts`.

## 25. After the approver buys, who attaches the receipt and finishes the request? (answered 2026-10-01, built: P-040)

- **Answered (Max, 2026-10-01): A**, and the employee also gives the item's web page (the link, P-039). Built.

- **Options:** A. The approver attaches the receipt or invoice on the request page and chooses "Mark purchased"; the app builds the folder for processing (recommended: one person finishes it, and the receipt is with the person who bought). B. The employee attaches it after the approver forwards it, and submits as today (the app changes least, but the employee has a step only the approver can trigger). C. Receipts go through your existing receipt filing and the request just closes in the app (the folder would hold the CSV only, so the app no longer shows that a receipt exists).
- **Recommendation:** A.
- **If you choose differently:** the submit and processing actions in both data services and the request pages.

## 26. Who ticks the certification when the approver buys? (answered 2026-10-01, built: P-041)

- **Answered (Max, 2026-10-01): A.** Built.

- **The sentence** (yours, exact): "I certify that the listed purchases are for official Clarus Labs business purposes, are not personal expenses, have not been reimbursed elsewhere, and that the information provided is accurate to the best of my knowledge."
- **Options:** A. The employee ticks it when they send the request (recommended: they no longer submit anything, and the sentence is about business purpose and the accuracy of what they entered). B. The approver ticks it when marking the purchase done. C. Both.
- **Recommendation:** A. For requests an employee buys themselves, the tick stays at Submit as today.
- **If you choose differently:** `sendForApproval` and `submitRequest` in both data services, the send and submit dialogs.

## 27. The 13-category list (answered 2026-10-01, built: P-038)

- **Asked:** the first build's eight categories become the 13 QuickBooks accounts in question 1's table, with "R&D Materials & Supplies" and "Equipment" separate and the four additions. **Answered (Max, 2026-10-01): yes.** Built.

## 28. The item link on each row (answered 2026-10-01, built: P-039)

- **Asked:** A. The link is required on each row when the approver buys, or a reason there is no web page ("No web page: say why"); optional when the employee buys. B. Always optional. C. Always required. **Answered (Max, 2026-10-01): A.** Built.

## 29. What the approver may change when buying (answered 2026-10-01, built: P-040)

- **Asked:** A. The approver may change every row and add or remove rows (shipping, tax), and the rows as the employee sent them are kept to show what changed. B. Amounts only. **Answered (Max, 2026-10-01): A.** Built.

## 30. The employee will not see the rows or receipts the approver adds (new, 2026-10-01)

- **What happens:** SharePoint shows each person only the items they created. When the approver adds a row or attaches a receipt to an employee's request, the employee does not see it. They see the request's status (Purchased) and its totals, which include the added row. I expect this, but it is **Unverified** until the test-site checkpoint (step 33, Check 8).
- **Options:** A. Accept it: the employee sees the status and totals, and the folder and CSV are the record (recommended: nothing to build, and the employee has no part in what the approver buys). B. Copy the rows as bought onto the request so the employee can read them (a second copy to keep true). C. Give the employee read access to the approver's rows (a second permission model).
- **Recommendation:** A. Tell me if employees need to see what was bought.
- **If you choose differently:** the data layer and `docs/DATA_MODEL.md`.

## 31. Only the Owner who approved a request can buy it (new)

- **What happens:** the Owner who approved the request is the one who can change its rows and mark it purchased. Another Owner can view it. Today you are the only Owner, so nothing changes for you.
- **Options:** A. As built (recommended: the record says who bought it). B. Any Owner can buy any approved request (then "approved by" no longer says who bought). C. Hand a request to another Owner.
- **Recommendation:** A until there is a second Owner; then decide whether C is needed.
- **If you choose differently:** `mayBuy` in `statuses.ts` and `buyRefusal` in `serviceRules.ts`.

## 32. Where Equipment is capitalized, and whether a class is needed (new)

- **What happens:** Equipment shows "Administrator decides" (expense it to 6175, or capitalize it to 1415 Fixed Assets:Equipment), and the app has no dollar threshold for capitalizing. The CSV also has no QuickBooks class column.
- **Options:** A. Leave both to the purchasing policy, the last stage (recommended). B. Tell me a capitalization threshold now (for example "$5,000 or more"), and the app can mark such a row for review. C. Tell me which class each project or category uses, and a class column can be added.
- **Recommendation:** A. Neither blocks the test-site checkpoint.
- **If you choose differently:** `purchaseRules.ts` for B; `csv.ts` and `purchaseRules.ts` for C.

## Reminders (no answer needed)

- Before go-live: export the QuickBooks account list again and compare it with `purchaseRules.ts` (`docs/CHECKPOINT.md` step 35).
- The suggested-account Unverified label is gone because you supplied the accounts, but the numbers and names are from your message, not from a file Claude opened.

## Not built, on purpose

A late-submission warning, a "future purchase date" warning, withdrawing a request, counting a vendor across requests, a separate approver role, and emails to the employee.
