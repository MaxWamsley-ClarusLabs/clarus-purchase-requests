# Decisions log

Every project decision, newest last. Each entry gives the date, the decision, the options considered, and why the others were rejected. "Max" is Max Wamsley, CEO, who approves all decisions.

**Status labels**
- **Decided (Max):** Max decided it in his overnight build prompt of 2026-09-30.
- **Decided (Max, 2026-10-01):** Max answered in his messages of 2026-10-01 (questions 1 to 5 and 24 to 29 in `docs/QUESTIONS_FOR_MAX.md`). Where an entry below says so, the decision is his; the details that Claude worked out in building it are labelled Provisional (Claude) inside the entry.
- **Provisional (Claude, awaiting Max):** Claude chose it overnight where the prompt was silent, because Max asked for work to continue without waiting. Each is built as recommended and listed in `docs/QUESTIONS_FOR_MAX.md` with the options and where a change would go. A provisional decision stays in force until Max answers.
- **Carried over:** a decision of the Travel Expense App (repository `MaxWamsley-ClarusLabs/clarus-travel-expense`, decisions D-001 to D-079) that applies here unchanged. The travel decisions are not repeated here; they are referenced as "travel D-nnn".

A decision stays settled unless new facts affect it. If a later entry replaces an earlier one, both entries say so.

---

## Decided by Max

## P-001. Build a Purchase Request app as a near copy of the Travel Expense App

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** The Purchase Request app copies the travel app's structure, code, tests, tooling, CI, records format and design, and adapts them for non-travel purchases. The architecture and technical decisions carry over unchanged: a SharePoint Framework web part (SPFx 1.23.2, Heft, React 17.0.1, TypeScript 5.8.3), SharePoint lists, Power Automate flows with standard connectors only, no app registration, no Microsoft Graph and no Azure; a local Vite preview on synthetic data, Vitest plus Jest tests, a Playwright screenshot script, a GitHub Actions build that produces the `.sppkg`; and the in-browser receipt reader with receipt suggestions and vendor memory (travel D-074, D-078, D-079).
- **Options considered:** none. Max: there is no architecture debate for this project; the answer is the same as travel. Older notes from other agents that suggest an architecture-debate stage are superseded.

## P-002. Scope: non-travel purchases, replacing the Word form and the Teams posting

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** The app is for non-travel purchases. Travel purchases go to the Travel app, and the Instructions say so. Removed because they are travel only: trip dates, destination, mileage, GSA rate tables, the daily meal limit, the late-trip warning and the travel categories. Today the F2 Purchase Request and Approval Form is sent through the Purchasing Receipt Team on Microsoft Teams with the supervisor @-mentioned; the app replaces that.

## P-003. What a purchase request contains

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** From form F2: a header with the employee name (from the signed-in account), department, approver (the site Owners, today Max), date submitted and purchase date(s), business purpose, and project or grant code ("NSF SBIR Phase 1 (Award # 2528301)" offered as a quick pick, not a default). Lines, one per purchase: date, vendor, what was bought and why, amount, who paid (Company or Employee), receipt attached (yes or no), and an approval status that the app works out. Receipts, invoices, quotes and approvals are attachments in line order, as in travel.

## P-004. No policy document; every rule in one place

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** The old P4 policy is not used and was not looked for. When the app is complete, Max will write a new purchasing policy with Claude; that is the last stage in `docs/STRATEGY.md` and `docs/STATUS.md`. Every rule (thresholds, quote rule, categories, certification sentence, account mapping) lives in one clearly named domain file, `app/src/domain/purchaseRules.ts`, so the new policy can change them in one place.

## P-005. Approval threshold: $500

- **Date:** 2026-09-30
- **Status:** Decided (Max). Confirmed again on 2026-10-01, with the quote rule (P-015): the attached F2 form's $100 supervisor approval and "over $500" quote wording are retired and are not to appear in the new SOP or the purchasing policy.
- **Decision:** Under $500: no approval is needed, but the employee still submits the request with receipts. $500 or more: needs approval in the app before the purchase.
- **Changed 2026-10-01 (P-037):** this applies to a request the employee buys. A request the approver buys, the usual case, goes to the approver whatever the amount.
- **Note:** The attached F2 form (P4 wording) still says that purchases of $100 or more need approval and that purchases over $500 need a quote. Max's prompt decides $500 for approval, and the form's $100 is not used. The form text is one of the things the new policy stage updates. Listed as a question so Max sees it.

## P-006. Workflow and statuses

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** 1. Request: the employee creates a request with the planned purchases. 2. Approval: if any vendor-and-purpose total is $500 or more, the request goes to the approver. The approver gets an email with a link; in the app, the approver can Approve (and confirm categories) or Return with a note. A request under $500 skips this step. 3. Receipts: after buying, the employee attaches receipts and invoices, with receipt suggestions as in travel, then submits. 4. Processing: as in travel, the flow places a folder with receipt copies and a CSV in the destination and emails the administrator. The travel status model (Draft, Submitted, Returned, Processed, `_R2` resubmissions) is reused, with the approval states added. Approvers are the site Owners (the travel D-066 pattern); for now that is Max.
- **Changed 2026-10-01 (P-037, P-040):** when the approver buys, the request goes Draft, Awaiting approval, Approved, Submitted (shown as Purchased), Processed. The approver, not the employee, attaches the receipts and finishes the request.

## P-007. Where it lives

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** The shared "Forms and Apps" site (travel D-075). All list addresses start with "Purchase": `Lists/PurchaseRequests`, `Lists/PurchaseRequestLines`, `Lists/PurchaseSubmissions`. Set-up leaves other lists alone (travel D-077).

## P-008. Flow destinations

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** The Test flow package sends folders to the test site's own Documents library, `Purchases_Test/Purchases_To_Process`. The Live destination is `ExecutiveTeam/Shared Documents/01_Company Documents/Accounting/Purchases/Purchases_To_Process`. The flow creates only `Purchases`, `Purchases_To_Process` and new request folders, never touching anything else, and keeps the travel flow's read-only check that `01_Company Documents/Accounting` exists. It never touches `Accounting/Receipts_To_Process`. The destination is fixed in code, never taken from list data. The flow uses standard connectors only.
- **How the check is built (2026-10-01):** as in the travel app, the read-only check that `Accounting` exists is made by the Set-up page when it builds a Live package (`getFlowSettings`), not by a step in the flow. The flow itself creates `Purchases` and `Purchases_To_Process` by path if they are missing; what it would do if `Accounting` were missing is Unverified. The package generator also refuses to build a Live package for any destination other than the fixed one.

## P-009. One CSV, with the accounting suggestions

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** A single CSV like travel D-044 to D-053, with the category, a suggested QuickBooks account per category, the grant code, the approval status and the approver. The account mapping is marked "Unverified, to confirm with Max" in the code and the records. The QuickBooks connector is not used.
- **Changed 2026-10-01 (P-038):** the accounts now come from Max's message, as one column holding the account number and exact name.

## P-010. Certification at submit

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** The form's sentence, exactly: "I certify that the listed purchases are for official Clarus Labs business purposes, are not personal expenses, have not been reimbursed elsewhere, and that the information provided is accurate to the best of my knowledge." A tick box tied to the account, as in travel D-064. The wording lives in `purchaseRules.ts`; changing it changes what employees certify, so a change is recorded here.

## P-011. Money on screen, in the CSV and in the email

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** As in travel: "To reimburse" (lines the employee paid) and "Paid by Clarus" totals on screen, in the CSV and in the email. A third figure, the request total, is shown as well (Claude's addition, as in travel's "Trip total").

## P-012. Expense categories

- **Date:** 2026-09-30
- **Status:** Decided (Max), from the attached form. **Replaced 2026-10-01 by P-038**: Max supplied the QuickBooks accounts and the categories are now the 13 below.
- **Decision:** R&D Materials & Supplies / Equipment; Advertising/Marketing/Website; Computer, H/W & S/W Supplies; Office Supplies; Training and Education; Shipping/Postage; Business Insurance; Other (with a description). The employee suggests one per line, with vendor memory as in travel. The approver or administrator can confirm or change it.

## P-013. Overnight mode

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** For the overnight build only: no stopping to ask. Where there is a real choice not decided above, Claude takes the recommended option and builds it, records it here as "Provisional (Claude, awaiting Max)" with the options and the reason, and lists it in `docs/QUESTIONS_FOR_MAX.md`. From Max's next message the normal rule applies again: pause and ask, at most five numbered questions at a time.

## P-014. Records, git and safety rules

- **Date:** 2026-09-30
- **Status:** Decided (Max); carried over from travel `CLAUDE.md`
- **Decision:** Records in the travel format (`CLAUDE.md`, `docs/STATUS.md`, `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/STRATEGY.md`, `docs/DATA_MODEL.md`, `docs/SOP.md`), decisions starting at P-001, every commit adding a changelog entry (including reads of outside systems), implemented, tested, piloted and in production kept apart. Microsoft licensing, pricing and platform claims labelled Verified or Unverified with source and date. No em dashes; plain language. Stored list text is never displayed as HTML; email text is plain text escaped by the flow. Synthetic data only. One branch and one draft pull request for the whole build with a commit per stage; never merge or deploy; the GitHub build stays green. Must not be touched: the travel app and its repository, the current Power Apps apps and their lists, anything in the Accounting folder, QuickBooks, the tracker and log workbooks, the SOP files, Microsoft 365 and Entra ID configuration. No Microsoft 365, Outlook, Teams, SharePoint or QuickBooks connector is used overnight; Microsoft hosts are blocked here.

---

## Provisional choices (Claude, awaiting Max)

The first three are the default rules Max asked to have built and listed. Four of them (P-015, P-017, P-019 and P-020) have since been decided by Max on 2026-10-01, as each entry says; the others stay in force until he answers.

## P-015. Quote rule: $500 or more

- **Date:** 2026-09-30
- **Status:** Decided (Max, 2026-10-01: yes to "$500 or more", and the old form's $100 is retired; to be put in the new SOP). It was first built as Provisional (Claude).
- **Decision:** A vendor total of $500 or more also needs a quote, or a written no-quote reason, attached to the approval request. A quote is a file marked "quote" on one of the vendor's lines; the reason is text on one of those lines. The threshold is a separate constant from the approval threshold, so the two can differ.
- **Options considered:** "over $500" (above $500, which is what the attached F2 form says); a higher quote threshold; no quote rule; a quote required with no reason allowed. Chosen because Max wrote "$500 or more" and using the same number for both keeps the rule easy to explain.
- **Where a change goes:** `QUOTE_THRESHOLD_CENTS` and the comparison in `purchaseRules.ts`; wording in `messages.ts`.

## P-016. How thresholds count: vendor total within a request

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max). Max's prompt names this as a recommended default.
- **Decision:** A threshold applies to the total from the same vendor within a request, not to each line, so a purchase cannot be split across lines to avoid approval. A request has one business purpose and one project or grant code, so "the same vendor for the same business purpose in a request" is "the same vendor in the request". Vendor names are matched ignoring capitals, accents, spaces, punctuation and characters that show nothing (zero-width spaces and joiners, soft hyphens, variation selectors, Hangul fillers), in any alphabet ("Digi-Key" and "DigiKey", "Thor Labs" and "Thorlabs", "Café" and "Cafe" are each one vendor; "Amazon" and "Amazon.com" are two). A name with no letter or digit (such as "-") is matched as typed. A name made only of characters that show nothing is no vendor: the row needs a vendor before it is sent or submitted. A line with no vendor yet is counted on its own. Duplicate warnings and vendor memory match the same way. Every line counts, whoever paid. A matching rule that is too loose only ever asks for more approval, never less.
- **Options considered:** per line (easy to avoid by splitting); per vendor across all of an employee's requests in a period (catches splitting across requests, but needs a rule for the period and a way to explain it; not built, see the question); per vendor and per a business purpose typed on each line (the purpose would be free text, so matching would be unreliable).
- **Where a change goes:** `vendorKey` and `vendorGroups` in `purchaseRules.ts`; the request header (`docs/DATA_MODEL.md`) if a purpose per line is wanted.
- **Changed after review (2026-10-01):** the first version kept spaces and accents and dropped every non-Latin letter, so "Digi-Key" and "DigiKey" were two vendors and a $600 purchase typed two ways needed no approval. Found by two independent reviews; fixed with tests.

## P-017. Bought before approval

- **Date:** 2026-09-30
- **Status:** Decided (Max, 2026-10-01: "do whatever you think", so Claude's recommendation, option A, stands: send for approval flagged, then submit). It was first built as Provisional (Claude). With most purchases now to be made by the approver (question 24), the flag applies to the purchases an employee makes for themselves.
- **Decision:** A purchase of $500 or more already made without approval can still go through. When the request is sent for approval, a vendor total of $500 or more is flagged **Bought before approval** if any of its lines is dated before the day it is sent, or already has a receipt or invoice attached. The request still goes to the approver first. The flag stays on the request after approval. The administrator sees it in the submission email and in the CSV (a "Bought before approval" column). The employee submits for processing after the approval, as for any approved request. A flag, once set for a vendor, stays in later rounds, even if a date is changed. When a request is sent again after an approval, a vendor total the approval still covers (within the 10% allowance, P-019) is not newly flagged by a receipt or a date, because it was approved before it was bought; one that has risen past it, or was never approved, is.
- **Options considered:** block the request (Max said it can still be submitted); let the employee submit straight to processing while approval is pending (the folder and CSV would be made before the approval exists, so the CSV would be out of date after approval); ask the employee to tick "already bought" (an honest answer is needed; the date and receipt tests need no extra click). Chosen: two steps, send for approval flagged, then submit, because the folder and CSV are then built once with the approval in them.
- **Where a change goes:** `isAlreadyBought` and `groupsForApproval` in `purchaseRules.ts`, `approvalGroupsToSend` in `validation.ts`; the wording in `messages.ts`; the send dialog in `RequestWorkspace`.
- **Changed after review (2026-10-01):** the first version judged every vendor total afresh on each send, so a second send after an approval flagged vendors that had been bought after approval, and a flag could be erased by changing a date. The rule for a second send was not in Max's prompt: it is Claude's, and part of question 3.
- **Changed after the second review (2026-10-01):** approvals of earlier rounds are kept in the approval record (`earlier`: the newest approval for each vendor, kept when a request is sent again or returned at the approval step), so a vendor approved and then bought is not flagged when a later round is returned and sent again. A flag kept only from an earlier round has its own warning ("was flagged as bought before approval when it was sent before").

## P-018. The approval email is a branch of the same flow

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max) for the flow's design (question 7). Max asked Claude to choose and explain. That the approvers are the site Owners is Decided (Max, 2026-10-01, with P-020).
- **Decision:** One flow. The app records each request for approval as a Purchase Submissions item of type **Approval request**, written Uploading and then Ready like a package. The flow starts on Ready, claims the item, and branches on the type: an approval request only emails the approvers and is marked Packaged (shown in the app as "Approver emailed"); a processing package is handled exactly as in the travel flow. The approvers' addresses are the site Owners' addresses read by Set-up when it makes the flow package, with the administrator's own address as the fallback.
- **Options considered:**
  - A second flow triggered by the requests list: a second import, a second trigger to keep turned on, and no shared monitoring of failures. Not chosen.
  - Power Automate's Approvals actions: the approval happens in the app as Max decided; it adds another connector surface. Not chosen.
  - A live lookup of the Owners group inside the flow on each run: more actions to verify and to fail; the addresses change rarely. Not chosen; adding an approver means adding them as an Owner and making a new package from Set-up (the same as changing the administrator's address in travel, travel D-029).
- **Cost:** the flow definition has one more level of nesting than the travel flow. The package is checked with the same checker; the branch is tested at the checkpoint.
- **Where a change goes:** `app/src/export/flowPackage.ts`, `flow/FLOW.md`, `SubmissionType` in `docs/DATA_MODEL.md`.

## P-019. Approval covers what the approver saw

- **Date:** 2026-09-30
- **Status:** Decided (Max, 2026-10-01: yes, keep the rule). It was first built as Provisional (Claude); the 10% figure is now Max's.
- **Decision:** When the approver approves, the app records each vendor total of $500 or more as approved at that amount. The employee may change the request afterwards (actual prices differ from planned ones). A vendor total that is now more than 10% above its approved amount, or a vendor total of $500 or more that was not approved, needs approval again: Submit is blocked with a message, and the employee uses Send for approval again. Amounts below the approved amount never need approval again. The approver approves what was sent: if the vendor totals that need approval no longer match what was sent (the same vendors at the same amounts), for example after an edit made directly in SharePoint while the request awaited approval, Approve is refused and nothing is written; the approver returns the request with a note.
- **Options considered:** no check after approval (an approved request could be edited to any amount); no allowance (a small tax or shipping difference would need a second approval); a fixed dollar allowance. The 10% is a guess.
- **Where a change goes:** `OVERRUN_TOLERANCE_PERCENT`, `approvalCoverage` and `matchesWhatWasSent` in `purchaseRules.ts`.
- **Not covered (question 22, P-036):** the approval covers vendor amounts only. After approval the employee can still change the business purpose and the project or grant code, and remove a quote.

## P-020. One role for approver and administrator; self-approval; no withdrawing

- **Date:** 2026-09-30
- **Status:** Decided (Max, 2026-10-01: yes, the site Owners approve and an Owner may approve their own request). The no-withdrawing part was not asked and stays Provisional (Claude).
- **Decision:** The approver and the administrator are the same role for now: people with SharePoint's "Manage web site" permission, which site Owners have (travel D-066). An approver who is also the requester may approve their own request; the record, the email and the CSV say it was self-approved. An employee cannot withdraw a request that is awaiting approval; the approver returns it.
- **Options considered:** a separate approver list (no place to keep it without a fourth list or code changes; travel D-029 and O14 left this for later); no self-approval (Max is the only Owner, so his own requests could never be approved); a Withdraw button (more states and an email that has already gone out).
- **Where a change goes:** `SharePointDataService.requireAdmin` and `MockDataService`; `isSelfApproved` in `purchaseRules.ts`.

## P-021. Attachments have a kind: receipt or quote

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** Each attached file is a **receipt** (which includes invoices) or a **quote**. The kind is stored with the file's fingerprint on the line (`FileFingerprints`). The drop box has a switch, and the row menu offers "Attach a quote" and "Attach a receipt or invoice". When the approver buys, the box takes quotes only: the receipts are the approver's to attach (P-040). A line has a receipt only if it has a receipt file (or shares another row's). In the folder, receipt copies are `R01_...` and quote copies are `Q01_...`. The receipt reader reads receipt files only; quotes are typed. A file with no recorded kind (added directly in SharePoint, or whose kind could not be recorded) is treated as a quote and never counts as the receipt; if the kind cannot be recorded when a file is attached, the file is removed again. A row either holds its own receipt files or points at another row's receipt ("Same receipt as row"), never both.
- **Options considered:** one untyped list of files (a quote would count as the receipt, so Submit could pass with no receipt); typing by the request's stage (wrong for a purchase already made); a separate list for quotes (more lists to create and permission). The kind per file is the smallest change that keeps "Receipt attached: yes or no" true.
- **Where a change goes:** `AttachedFile.kind` in `types.ts`, `naming.ts`, `mapping.ts`, the grid and drop box.

## P-022. Request header details

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** The business purpose is one line of text and is also the request's name (the list item's title, shown in lists, folder names and email subjects). The project or grant code is a separate optional field, with quick picks from `PROJECT_QUICK_PICKS` (today one: "NSF SBIR Phase 1 (Award # 2528301)"), never filled in by default. Department is required, typed once, suggested from the employee's earlier requests, and filled in from their latest request when a new request is created. Purchase date(s) are not typed: they are the earliest and latest dates on the lines. The date submitted is set at Submit.
- **Options considered:** a separate short request name (one more field for every request); a business purpose and a project code as one field as on the paper form (the CSV needs the grant code on its own); a fixed list of departments (Max has not given one).
- **Where a change goes:** `docs/DATA_MODEL.md`, `purchaseRules.ts` (`PROJECT_QUICK_PICKS`), `validation.ts`, the Request details step.

## P-023. Who paid: Company or Employee

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max) for the defaults; the two choices are Decided (Max, P-003)
- **Changed 2026-10-01 (P-037):** asked only when the employee buys. When the approver buys, nobody is asked: the company pays every row.
- **Decision:** Two choices: Company and Employee. Employee-paid lines are "To reimburse". The first row of a request starts as Company and each new row copies the row above, and vendor memory remembers who paid last time (travel D-057, D-078). The travel app's "Suggested payment account" CSV column is dropped, because "Company" does not say which account paid.
- **Options considered:** no default, so every row needs a choice (more clicks); the default Employee (Max has not said which is more common).
- **Where a change goes:** `FIRST_ROW_PAID_BY` in `defaults.ts`; `CSV_COLUMNS` in `csv.ts`.

## P-024. Categories: the Other description and who confirmed a category

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** Choosing Other needs a short description of the category (the form's "Other: ____"), kept apart from "what was bought and why". Each line records who last confirmed or changed its category (the approver when approving, or the administrator later). The CSV has a "Category confirmed by" column, empty when only the employee has suggested the category. Choosing another category clears the description. The approver or administrator can confirm or change categories while a request is Awaiting approval, Approved or Submitted (`CONFIRMABLE_STATUSES` in `statuses.ts`); approving confirms every category shown. The administrator's change after submission is saved in the app, but the CSV already in the folder keeps the category as submitted.
- **Options considered:** rewriting the CSV after processing (a second write into Accounting, travel D-050 rejected the same idea); no record of who confirmed (Max asked for confirm or change by the approver or administrator).
- **Where a change goes:** `CategoryOther` and `CategoryConfirmedBy` in `docs/DATA_MODEL.md`; `confirmCategories` in the data services.

## P-025. Suggested QuickBooks accounts: names only, Unverified

- **Date:** 2026-09-30
- **Status:** **Replaced in part 2026-10-01 by P-038**: Max supplied the account numbers and names. The class column is still not carried over. The text below is the first build's.
- **Earlier status:** Provisional (Claude, awaiting Max). The mapping was **Unverified, to confirm with Max**.
- **Decision:** Plain account names without numbers: R&D Materials and Supplies; Advertising and Marketing; Computer and Software; Office Supplies; Training and Education; Shipping and Postage; Insurance; and none for Other (the administrator decides). Claude cannot look up the chart of accounts, because the QuickBooks connector is not used and account names in the travel repository cover travel only. Invented account numbers would look verified, so none are given. The CSV's "Suggested payment account" and "Suggested class" columns of the travel app are not carried over.
- **Options considered:** numbers with names (would be invented); leaving the column empty (Max asked for a suggestion); a class from the project code (the travel app's D-050 list maps a trip purpose, not a grant code; Max asked only for the grant code in the CSV).
- **Where a change goes:** `CATEGORIES[]` (its account fields) and `QUICKBOOKS_MAPPING_STATUS` in `purchaseRules.ts`.

## P-026. Naming and the CSV columns

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** Request number `PR-0042`. Folder `YYYY-MM-DD_Employee-Name_Business-Purpose_PR-0042` using the earliest purchase date, `_R2` for resubmissions. The CSV is `PR-0042_Purchases.csv` (`PR-0042_R2_Purchases.csv`). Columns (31 since 2026-10-01, P-037 to P-039): Request, Row, Date, Vendor, What was bought and why, Item link, Category, Category confirmed by, QuickBooks account (the number and exact name, or "Administrator decides"), Amount, Who bought, Who paid, Reimbursable, Project or grant code, Approval status, Bought before approval, Approved by, Approved on, Quote files, Receipt files, No-quote reason, No-receipt reason, No-link reason, Warnings, Submission, Submitted by, Submitted on, Department, Purchase dates, Business purpose, Certified by. "Certified by" is the employee who ticked the certification, also when the approver bought; "Submitted by" is whoever submitted, the approver when the approver bought. A cell that starts with = + - @ is written with a leading apostrophe, so a spreadsheet never runs it. The category is the category as submitted; "Approved by" names the approver (or the requester, marked self-approved).
- **Options considered:** filing by the submission date (an old purchase submitted late would land in the wrong year); splitting the CSV in two (Max prefers one CSV, travel D-045).
- **Where a change goes:** `naming.ts`, `CSV_COLUMNS` in `csv.ts`, `docs/STRATEGY.md` section 7.

## P-027. Who can edit a request, and when

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Changed 2026-10-01 (P-037, P-040):** when the approver buys, an Approved request is locked to the employee; it is the approver's to change.
- **Decision:** The employee can edit a request that is Draft, Returned or Approved. A request that is Awaiting approval, Submitted or Processed is locked (travel D-042). An Approved request stays editable because receipts and real prices arrive after the approval; P-019 keeps the approval honest. Returning a request after processing keeps its approval if nothing changed beyond P-019's allowance.
- **Options considered:** lock after approval (receipts could not be attached); reopen approval on any edit (too many approvals).
- **Where a change goes:** `isEditable` in `statuses.ts`.

## P-028. Certification only at Submit

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Changed 2026-10-01 (P-041):** this holds for a request the employee buys. When the approver buys, the employee ticks it when sending the request, because the employee submits nothing later.
- **Decision:** The certification is ticked at Submit, not when a request is sent for approval. Sending for approval needs no tick, because planned purchases have not been made or reimbursed yet; the certification covers what was actually bought.
- **Options considered:** certifying at both steps (two ticks; the sentence talks about purchases that "have not been reimbursed elsewhere").
- **Where a change goes:** `sendForApproval` in the data services and the send dialog.

## P-029. Accepted risk: an employee could mark their own request Approved in SharePoint

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max); follows travel D-002
- **Decision:** Employees can edit their own list items directly (travel D-002), so someone could set their own request to Approved outside the app. The administrator's review and SharePoint version history are the control, as in travel, and the submission email and CSV name the approver and the approval time. Revisit at the security review.
- **Options considered:** a tamper check that compares the approval with the approver's own records (needs the approval stored where employees cannot write; a fourth list and a second permission model); accepting the risk as in travel.
- **Also:** the approval record's earlier approvals are as editable as the rest of the record; editing them can only hide a bought-before-approval flag, not approve anything.
- **Where a change goes:** a security review item in `docs/STATUS.md`.

## P-030. Needs attention covers approval emails

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** An approval request whose email was not sent within 30 minutes, or whose sending failed, appears under Needs attention like a failed package, with Retry. Only the newest approval request of a request that is still Awaiting approval, and the newest package of a request that is still Submitted, are listed: once the request has moved on (approved in the app anyway, returned, processed) a stuck submission no longer matters and is not shown. The sidebar shows a count on **Approvals** (requests awaiting approval, plus, since P-037, the approved requests the signed-in approver has to buy), **Requests to process** and **Needs attention**. Retry (on the request page, reached from the Needs attention list) works only on a submission that failed or has not changed for 30 minutes, that is the newest of its kind, while its request is still Awaiting approval (an approval email) or Submitted (a package); otherwise it is refused, so an old approval email cannot be sent again for a request that has moved on. The request page shows each Retry button exactly when that rule allows it. The 30 minutes are counted from the submission's last change (SharePoint's Modified), so a Retry starts them again and a second Retry is not offered at once.
- **Options considered:** leaving approval emails unmonitored (an unnoticed failed email would stall a purchase); listing every failed submission for ever (old failures would bury the current ones).
- **Where a change goes:** `adminData.ts` (`stuckSubmissions`), the Needs attention page.

## P-031. Preview data is fictional

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** The preview's people are Jane Doe (employee), Sam Lee (employee) and Max Wamsley (administrator and approver) at `example.com`, as in travel; vendors are made up; sample receipts are generated and stamped "synthetic sample for testing". Note that Max Wamsley is a real person's name already used in the travel app's sample data; no real address or data is used.
- **Where a change goes:** `app/src/data/mock/sampleData.ts`.

## P-032. Screens: how approval shows to the employee and to the approver

- **Date:** 2026-10-01
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** The request is made in three steps, as in travel: Details, Purchases and Review. The Purchases step has the drop box (with a Receipts or invoices / Quotes switch), the grid and a **Vendor totals** table that shows, for each vendor, the total, whether it needs approval, and whether it has a quote. The Review step lists what to fix, then a card for the approval (what needs approval, and what changed since it was approved). The header has one main button, labelled for the step that applies (Send for approval or Submit request), and disabled while a blocking problem remains. The files panel sits beside the grid only when the page is wide enough for the whole grid; otherwise it is a slide-over, and the row menu stays reachable when the grid scrolls sideways. The "No quote: say why" box appears on the first row of a vendor total of $500 or more while the request is waiting to be sent, and the "No receipt" box appears once approval is done. A request that is Approved opens again for receipts and real prices (P-027). The administrator's side has an **Approvals** page (requests awaiting approval), and one request page with tabs (Purchases, Vendor totals, Approval email, Submission email, CSV file, Folder contents). While a request awaits approval, each category there is a drop-down; Approve confirms the categories shown, says how many were changed, and takes an optional note; Return needs a note. Each attached file on the Purchases tab opens in a preview, so the approver can read the quote (in SharePoint this relies on the Owners being able to read the rows' attachments, which is Unverified). A returned request says who returned it (approver or administrator) and shows the note. Most wording is in `messages.ts` and `content/instructions.ts`; some labels and hints are in the screens themselves.
- **Options considered:** one screen for everything (a long page to scroll on a laptop); the approver approving each line (Max decided approval is by request; thresholds count by vendor total, P-016); a separate approver app (a second web part).
- **Where a change goes:** `app/src/ui/` (`RequestWorkspace.tsx`, `PurchaseGrid.tsx`, `VendorTotals.tsx`, `pages/admin/AdminRequestPage.tsx`); screenshots in `docs/prototype/`.

## P-033. Accepted risk: an employee can make the flow send an approval email

- **Date:** 2026-10-01
- **Status:** Provisional (Claude, awaiting Max); follows P-029
- **Decision:** Employees can create and edit their own Purchase Submissions items (travel D-002). So an employee could create an item of type Approval request, status Ready, with any subject and summary, and the flow would email every Owner from the administrator's mailbox. What stays safe: the summary is escaped, so it cannot hold markup; the recipients and the link in the email are fixed in the package; nothing is created in the destination folders. What it allows: a misleading message to the Owners, such as a fake approval request. It is not a way to approve a purchase. Accepted for the pilot; look again at the security review.
- **Options considered:** (A) accept it, as built; (B) the flow writes the subject itself from fixed columns and adds a fixed line saying the summary was written by the requester's app session (the app's "Approval email" tab would need the same line); (C) keep approval requests in a list employees cannot write to (a fourth list and a second permission model, as in P-029).
- **Where a change goes:** the approval branch in `app/src/export/flowPackage.ts`, `email.ts`, and the "Approval email" tab in `AdminRequestPage.tsx`.

## P-034. Integrity rules the services enforce

- **Date:** 2026-10-01
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** The app cannot stop an employee editing their own SharePoint items (travel D-002), so the services check what they can, and the rest is left visible in version history. (1) Approve is refused if the vendor totals that need approval no longer match what was sent (P-019). (2) A row or a submission counts for a request only if the request's owner created it; anyone can type another person's request number into a new item, and such an item is ignored. (3) Retry is limited to a failed or stuck submission that is the newest of its kind while its request is still at that step (P-030). (4) A row holds its own receipt or points at another row's, never both (P-021). (5) A file with no recorded kind is a quote (P-021). (6) The request number shown is made from the item's ID, not from the editable column. (7) The services clear the approver, approval date, approval note or return stage only when there is one to clear: not on a first send, not on approving a request that was never returned, not on returning one that was never approved (those clears are Unverified, question 23). (8) Stored approval keys are recomputed from the stored vendor names with the current matching rule, so changing the rule at the policy stage does not orphan a pending approval. (9) "Not finished within 30 minutes" is counted from the submission's last change (P-030).
- **Options considered:** leaving these to the administrator's review (each is a way for a mistaken or dishonest edit to look like an honest record); a tamper check against a second list (P-029's option B).
- **Where a change goes:** `serviceRules.ts`, `SharePointDataService.ts`, `MockDataService.ts`, `mapping.ts`, `matchesWhatWasSent` in `purchaseRules.ts`.

## P-035. Typing, pasting and saving limits

- **Date:** 2026-10-01
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** An amount takes a comma only as a thousands separator ("1,234.56"); "12,50" is refused rather than read as 1,250.00. Amounts above $10,000,000.00 are refused. A date must be a real date in 2000 to 2099 (a date box typed as 101426 can hold year 0026). Pasting from a spreadsheet reads tab-separated text with quoted cells, in the grid's column order, with dates like 2026-10-14, 10/14/2026 or Oct 14, 2026; rows that do not fit and cells that cannot be read are skipped, and one message says how many and why. Text is cut at 255 characters. Changes save about half a second after the last keystroke, one save after another; Send for approval and Submit wait for every save to finish and stop with a message if one failed. Closing or reloading the page with something unsaved asks the browser to confirm first and tries to save it; leaving at once, within about a tenth of a second of typing, can still lose the last characters. A very long word with no spaces breaks at the edge of its box instead of widening the page.
- **Options considered:** reading "12,50" as 12.50 (ambiguous with thousands); no upper limit on amounts; a date window of a year around today (a purchase may be filed late); growing the grid to fit pasted rows (more risk of unintended rows).
- **Where a change goes:** `money.ts`, `dates.ts`, `app/src/ui/pasteParse.ts`, `PurchaseGrid.tsx`, `RequestWorkspace.tsx`.

## P-036. After approval, only vendor amounts are re-checked

- **Date:** 2026-10-01
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** What is recorded when the approver approves is each vendor total of $500 or more (P-019). After approval, an employee can still change the business purpose, the project or grant code and the suggested categories, delete rows, and remove a quote; none of that sends the request back for approval. The submission email and the CSV show the purpose and code as submitted, and the approver's name and time. This is a gap found by review, not a rule Max asked for.
- **Options considered:** also record the business purpose and project or grant code with the approval, treat a change as "changed since approval", and warn the administrator in the submission email (a typo fix would also trigger it); lock a request once approved (receipts and real prices could not be attached, P-027).
- **Recommendation:** record both with the approval and warn the administrator. Not built: it changes what "approved" means, so it waits for Max (question 22).
- **Where a change goes:** `ApprovalRecord` in `types.ts`, `approvalState` in `purchaseRules.ts`, `submission.ts` and `email.ts`.

---

## The approver buys: Max's decisions of 2026-10-01 and the details built from them

Max said that about 95% of purchases are bought by the person who approves them, and asked for that to be the default. He answered questions 24 to 29 on 2026-10-01. These six entries record it. Where a detail is Claude's, the entry says Provisional (Claude).

## P-037. Who buys: the approver, by default, chosen on each request

- **Date:** 2026-10-01
- **Status:** Decided (Max): the approver buys by default; question 24, "do recommended" (his words: "this process is correct"). The details marked Provisional (Claude) are Claude's.
- **Decision:** Each request has "Who buys this?" with **The approver buys it** (the default) and **I will buy it myself**. The employee chooses while the request is a Draft or Returned. When the approver buys: the employee enters what to buy (vendor, what and why, estimated amount, category, the item link, and a quote at $500 or more) and sends it with the certification (P-041). Every such request goes to the approver, whatever the amount, because the approver has to act on it. The approver approves, buys, corrects the actual amounts, attaches the receipt and chooses **Mark purchased**; the app then builds the folder and CSV as it does after a submit (P-040). The employee submits nothing. The $500 approval threshold (P-005), the 10% rule (P-019) and the bought-before-approval flag (P-017) apply only to a request the employee buys, which works as the first build did. The quote rule at $500 or more (P-015) applies to both. "Who paid" is not asked when the approver buys: the company pays every row, the totals and the CSV count it so whatever is stored, and "To reimburse" is $0.00.
- **Provisional (Claude):** the buyer is chosen only while the request is a Draft or Returned; the services refuse a change at any other status, and the screen locks the choice once the request has been approved. Changing it on a returned request takes back any approval the request held (a request returned at processing keeps its approval), so it goes through approval again; a bought-before-approval flag goes when the approver will buy. Rows keep what the employee chose for "who paid", which comes back if the buyer is changed back. After the approval, a request the approver buys stays Approved however the amounts change when the approver buys (the 10% rule protects the approver from the employee; here the approver is the buyer). A request the approver bought is shown as **Purchased** where the status is Submitted. The bought-before-approval flag is never set for it.
- **Options considered (question 24):** A. a per-request choice, the approver as the default (chosen); B. one setting for the whole site; C. keep the first build's flow and treat an approver purchase as an exception. A keeps the 5% where an employee buys working as before, and the default means the usual case needs no extra click.
- **Where a change goes:** `BUYER_OPTIONS`, `DEFAULT_BUYER`, `approvalThresholdCents` in `purchaseRules.ts`; `statuses.ts`; both data services; `docs/DATA_MODEL.md` (the Buyer column).

## P-038. Categories are the QuickBooks accounts

- **Date:** 2026-10-01
- **Status:** Decided (Max): the accounts (question 1, "B", supplied in his message after he read the account list himself) and the 13-category list (question 27, yes). Equipment and Other, and the Mark processed hold, are Provisional (Claude). Claude did not open the account file.
- **Decision:** The 13 categories carry the exact QuickBooks account names, so the employee's choice is the account: R&D Materials & Supplies 6182; Equipment 6175 (the administrator decides whether it is expensed or capitalized to 1415 Fixed Assets:Equipment); Advertising/Marketing/Website 6500; Computer, H/W & S/W Supplies 6178; Office Supplies 6180; Training and Education 6155; Shipping/Postage 6184; Business Insurance 6215; Dues and Subscriptions 6150; Telephone/Internet 6185; Repairs & maintenance 6170; Professional Services 6050; Other (no account). Max's message also corrected four of the first build's suggested names and added four categories (Dues and Subscriptions, Telephone/Internet, Repairs & maintenance, Professional Services), and split "R&D Materials & Supplies / Equipment" into two. The CSV has one column, "QuickBooks account", with the number and exact name. There is no class column (P-025). The accounts are labelled "from the May 1, 2026 account list" in the code. **Compared on 2026-10-01** with the account list Max pasted in his next message (text and a picture; the export date of that list was not stated): all 12 account numbers and names match, and 1415 Fixed Assets:Equipment exists. **Re-export the account list and compare it with `purchaseRules.ts` once more before go-live** if the chart of accounts has changed since (`docs/CHECKPOINT.md` step 35). Accounts in the list that no category covers (for example 9300 Patent Expenses, 6160 Facilities Rent, 6190 Utilities, 6220 Business Meals w/Clients, 6230 Business licenses, 6510 Entertainment, 6535 Business Gifts, 6540 Contributions/Donations, 6055 Subconsultants/Subawardees) are reached through Other, for the administrator to decide; Max approved the 13 categories (question 27), so none was added.
- **Provisional (Claude):** Equipment shows its account 6175 with a note that the administrator decides whether to expense it or capitalize it to 1415 Fixed Assets:Equipment, and Other shows "Administrator decides" where an account would be. Approving confirms the categories shown, so a request the approver buys is confirmed at approval; a request nobody approved (an employee-bought request under $500) is refused at **Mark processed** while a row in either category is unconfirmed, and the administrator uses Confirm categories first. The line between expensing and capitalizing equipment is left to the purchasing policy (the last stage).
- **Options considered:** keep the first build's eight categories with suggested names (Max supplied the accounts, so no longer needed); several accounts per category with a second choice (more clicks).
- **Where a change goes:** `CATEGORIES` and `QUICKBOOKS_MAPPING_STATUS` in `purchaseRules.ts`; `rowsToReview` in `serviceRules.ts`. The CSV column is named exactly "QuickBooks account"; where the accounts come from is shown on the administrator's CSV tab.

## P-039. The item link

- **Date:** 2026-10-01
- **Status:** Decided (Max): question 25 (the employee also gives the web page of the item) and question 28, option A. The checks below are Provisional (Claude).
- **Decision:** Each row has an **Item link** (the web page of the item) and, if there is none, a short **No-link reason** ("No web page: say why"). When the approver buys, each row needs one or the other before the request can be sent. When the employee buys, it is optional.
- **Provisional (Claude):** the link is stored in a plain-text column and kept whole; one longer than 2,000 characters is refused, never cut, because a cut address opens another page. Only an address that starts http:// or https://, has a dotted host name, has no spaces and carries no user name or password is shown as a clickable link (opening in a new tab); anything else is shown as plain text and refused at validation. The CSV carries the link and the reason (a cell that starts with = + - @ is escaped). The emails do not carry the link. Because the list text can be edited directly (travel D-002), this is the only place stored text becomes a link.
- **Where a change goes:** `safeLink`, `ITEM_LINK_MAX_LENGTH`, `NO_LINK_REASONS` in `purchaseRules.ts`; `validation.ts`; the grid.

## P-040. The approver buys: edits, the rows as sent, Mark purchased

- **Date:** 2026-10-01
- **Status:** Decided (Max): question 25, option A (the approver attaches the receipt and chooses Mark purchased) and question 29, option A (the approver may change everything and add or remove rows, and the rows as sent are kept). The rest is Provisional (Claude).
- **Decision:** After approving, the approver opens the request (**Open to buy**) and may change every row, add or remove rows (shipping, tax) and attach the receipts and invoices. When the rows are complete, **Mark purchased** builds the folder and CSV and emails the administrator, as a submit does. The rows as the employee sent them are kept with the approval record and shown on the request page next to what was bought ("As sent for approval"), so the administrator sees what changed.
- **Provisional (Claude):** the Owner who approved the request is the one who buys and finishes it; another administrator can view it but not change its rows, attach files to it or mark it purchased. **Any administrator can return it to the employee** (Max, 2026-10-01, question 31: "should be able to return it"), so a request is never stuck when the approver cannot act; it is refused while rows the approver added would be left behind (P-042). The approver does not change the request's header (business purpose, department, project or grant code): that is the employee's, and the approver returns the request if it is wrong. The category the approver chooses while buying counts as confirmed by them. The package's submitter is the approver; the certification is the employee's (P-041). The approver's page for a request waiting to be bought is the Approvals page's **To buy** list.
- **Options considered:** the employee attaches the receipt later (question 25, B: the employee has a step only the approver can trigger); the receipts go through the existing receipt filing (C: the folder would hold only the CSV); the approver edits amounts only (question 29, B: shipping and tax rows could not be added).
- **Where a change goes:** `markPurchased`, `requestForChange` and `mayBuy` in the data services and `statuses.ts`; `SentRowsCard.tsx`; `AdminRequestPage.tsx`.

## P-041. Certification when the approver buys

- **Date:** 2026-10-01
- **Status:** Decided (Max): question 26, option A (the employee ticks it when sending the request). The storage and the check are Provisional (Claude).
- **Decision:** The sentence is the same (P-010). For a request the approver buys, the employee ticks it in the send dialog, and Send stays disabled until it is ticked. For a request the employee buys it stays at Submit (P-028).
- **Provisional (Claude):** the sentence is kept on the approval request (Purchase Submissions item), with the employee's account. **Mark purchased** reads it from the newest approval request and refuses to build the package if it is missing or is not the exact sentence, telling the approver to return the request so the employee can send it again with the tick. The submission email and the CSV name the employee as certifying. Accepted risk, of the same kind as P-029: the employee can edit their own approval request item directly in SharePoint, so the stored sentence is only as honest as that item; the exact-sentence check and the version history are the controls. Revisit at the security review.
- **Where a change goes:** `sendForApproval` and `markPurchased` in the data services; `employeeCertification` in `serviceRules.ts`; the send dialog.

## P-042. Integrity and return rules when the approver buys

- **Date:** 2026-10-01
- **Status:** Provisional (Claude, awaiting Max). Follows from P-037 and P-040; not asked.
- **Decision:** (1) A row or a submission counts for a request if its owner made it, or, for a request the approver buys, if the approver recorded on the request made it (P-034 widened; the rule stays "a request's rows are made by people with a stake in it"). (2) SharePoint shows people only the items they created, so the employee does not see the rows the approver adds; receipts the approver attaches to a row the employee made stay visible to them. The employee's list shows the stored request total, which includes the added rows, and the request page adds up only the rows the employee can see. Accepted, to be checked at the checkpoint (Unverified; `docs/CHECKPOINT.md` step 33, Checks 7 and 8). The preview cannot show this: its mock service returns every row. (3) Any administrator can return an Approved request to the employee (the approval is taken back); this is refused while rows the approver added exist, because they would stop counting once the approval is taken back: the approver deletes them first. (4) The administrator's return at processing sends a request the approver bought back to the approver (status Approved), not to the employee; Mark purchased then builds the folder again (`_R2`). (5) When the approver buys, "Who paid" is forced to the company at every write and in the totals and the CSV, and a hidden "Who paid" suggestion (from vendor memory or the receipt reader) never blocks a row. (6) Mark purchased, and changing the rows or files, are refused unless the person is an administrator and the one who approved the request; returning the request to the employee is open to any administrator, and refused while rows the approver added would be left behind (the message names the approver, who deletes them).
- **Known limits (reviews, 2026-10-01), not fixed:** (a) if two Owners are involved (one approves and buys, the approval is returned, another approves and buys again), the first Owner's package stops counting for the request, so the second package's email loses its "This replaces the earlier folder" line; (b) if the recorded approver is blank or can no longer act, any administrator can return the request (question 31, answered), but nobody else can buy it, and a return is refused while rows the approver added exist, until the approver deletes them; (c) the approval record keeps every row as sent, including its item link, in one multi-line column; whether a request with about thirty rows with very long links fits is Unverified (the send fails closed and leaves a stalled item for the next try); (d) a row the employee dated today while the approver was to buy keeps that date if the employee then chooses to buy it themselves, and a later send can flag it as bought before approval, a warning the employee can still send; (e) added 2026-10-01 from a reading of `flowPackage.ts`: the step that claims a submission (`Claim_the_submission`) runs outside the Package and On_failure scopes, so a failure there sends no failure email (Power Automate may still tell the flow owner; Unverified); (f) the flow names each copied file from the attachment name as stored, without cleaning it (the app sets the names, so only a direct SharePoint edit could change them; SharePoint itself limits the characters in an attachment name, Unverified). Both are low risk and were left alone while the install checkpoint runs (question 33).
- **Options considered:** let the employee see the approver's rows (a second permission model or a copy of the rows on the request: more code and a copy to keep true); let any Owner buy (then the recorded approver no longer says who bought); send a processing return of an approver purchase to the employee (the employee cannot change what the approver bought).
- **Where a change goes:** `serviceRules.ts` (`authorsOf`, `returnStageFor`, `statusAfterReturn`, `buyRefusal`), both data services, `suggestions.ts` (`visibleSuggestions`).

## P-043. The checkpoint is done on the real Forms and Apps site, with the Test flow first

- **Date:** 2026-10-01
- **Status:** Decided (Max, 2026-10-01: "I don't want a test site I want to go straight into making the site for all forms"). The safeguards are Provisional (Claude).
- **Decision:** The first install (`docs/CHECKPOINT.md`) is made on the new shared site `/sites/FormsandApps` (a Communication site, named people as Owners; P-007, travel D-075), not on a throwaway test site. Claude had recommended a throwaway site, so that test lists and people would not end up on the real site; Max chose the real site.
- **Provisional (Claude):** the flow imported first is still the **Test** package (folders go to the site's own Documents library, P-008), so nothing is written to the Accounting folder until the checkpoint passes. Part 8 of the checkpoint then turns the Test flow off, deletes the test items and the `Purchases_Test` folder, makes and imports the **Live** package, and watches one request arrive. Two flows must never be on together, because both watch the same Purchase Submissions list. Test requests use up request numbers on the real lists, so the first real request is not PR-0001. The approvers are the Owners at the time the package is made (P-018), so the Owners are set before the packages are made.
- **Where a change goes:** `docs/CHECKPOINT.md`, `docs/SOP.md` B8 and B9.

## P-044. The purchasing policy: scope and the new rules (draft R0)

- **Date:** 2026-10-01
- **Status:** Decided (Max, 2026-10-01, in the policy workshop). The draft is `docs/POLICY.md`; it is not adopted. Details marked Provisional (Claude) are Claude's drafting choices.
- **Decision:** (1) Claude drafts the policy in Max's style without reading the existing company policies (Max: "I want you to draft it yourself"). (2) A short section on grant-funded purchases: the project or grant code is required, the approver checks the purchase is allowable under the award, and the award terms rule. (3) One approval tier: $500 (P-005); no second approver and no extra quote tier. (4) **Equipment over $5,000 per item bought with grant funds needs prior written approval from the NSF program officer.** The $5,000 is only a grant rule. Equipment in QuickBooks has no minimum cost (Max: "equipment on Intuit can be any cost"), so there is no capitalization threshold in the policy; the administrator still decides how it is booked. This closes question 32. (5) Employee-paid purchases: the company card or an invoice is the default; an employee may buy and be reimbursed, with approval as in P-005, receipts, and submission within 30 days of the purchase date (the 30 days is Claude's recommendation, accepted by Max's "agree with 5").
- **Provisional (Claude):** the policy applies to employees and anyone who buys for Clarus; prohibited purchases are personal items, anything reimbursed elsewhere, gifts and entertainment without the CEO's written approval, and splitting a purchase to avoid a threshold; the CEO may approve exceptions in writing and only the CEO changes the policy. Two placeholders remain: the effective date and the record retention period.
- **Not yet in the app:** the $5,000 grant rule and the 30-day deadline are in the policy only. The app does not check them (the approver is the control). A warning for Equipment rows of $5,000 or more on a request with a grant code, and a late-submission warning, are possible later changes to `purchaseRules.ts` and need Max's yes.
- **Where a change goes:** `docs/POLICY.md`, the Word copy in `Purchase Requests / SOP and Policy`, and `purchaseRules.ts` if the app is to enforce more.

## P-045. A Microsoft Forms quiz so every employee shows they understand the SOP

- **Date:** 2026-10-01
- **Status:** Decided (Max, 2026-10-01). The questions are Claude's drafting and are Draft R0 until Max has read them.
- **Decision:** (1) A **Microsoft Forms quiz**, not a page in the app and not a handout (Max chose option A). (2) **15 questions, 14 correct to pass** (Max). (3) **Anyone can take it, and the completion is emailed** (Max: "Anyone can take and submit it. I want an email confirmation that they completed it"). Max sends the link out by hand. (4) The link to the quiz goes in the SOP, and Max will put links to the SOP and the training on the Forms and Apps site home page. (5) **Claude does not make the Form. A second Claude chat that drives Max's browser builds it** from `docs/TRAINING_QUIZ.md`, which holds the instructions, the 15 questions, the answer key, the feedback lines and the home page steps. Max signs in and approves the home page publish; nothing else is asked of him. No importable file for Forms is known (Unverified).
- **Provisional (Claude):** the Form is limited to people in the company, with names recorded, so that the completion record and the email receipt work (Max said "anyone"; if he meant people outside the company, change this one setting). Retakes are allowed and the correct answers are shown after each attempt. The Form emails Max for each response, and the respondent for a receipt, if Forms offers both (Unverified). The quiz covers only what the app and the SOP do today: the 30-day deadline and the $5,000 grant equipment approval wait for the adopted policy, when two questions can be added and the count and pass mark are Max's decision again. The answer key stays in the repository and is never saved to the SharePoint folder employees can open.
- **Checks made:** a fresh agent took the quiz using only SOP Part A and got 15 of 15, which found three stems to reword (Q2, Q8, Q12); a second agent checked every answer against the code and found two more (Q4 needed "The approver will buy it", Q9 needed "What should you do?" because changing the date works in the app when no receipt is attached). Option lengths were evened out so that the longest option is not always right. Q11 depends on the SOP's gloss "recurring software goes under Dues and Subscriptions", which is Claude's wording and not yet confirmed by Max.
- **Not verified:** how Forms behaves (quiz scoring, option comments, recording names, email receipts and notifications, Quick import). All of it is Unverified, since Microsoft's documentation is blocked here; the build instructions say to stop and report if a screen does not match.
- **Where a change goes:** the questions in `docs/TRAINING_QUIZ.md` first, then the Form. Whoever changes `purchaseRules.ts`, the Instructions text or the SOP checks the quiz (the drift rule is in the quiz file, section 6).


## P-046. A separate chat helps enter processed requests in QuickBooks

- **Date:** 2026-10-05
- **Status:** Decided (Max asked for it, 2026-10-05). How it works is open: the five first questions are in the briefing.
- **Decision:** One separate Claude chat, outside the app, helps Max (administrator) enter each processed purchase request in QuickBooks. `docs/QUICKBOOKS_HANDOFF.md` is the briefing Max pastes into it. It carries the folder and CSV format, the 13 category accounts, what each CSV column means, the existing process it must fit (SOP B4, `Clarus_Accounting_SOP.md`, the receipt skill), the hard rules and the first questions.
- **What does not change:** the app, the CSV and the flow still do not touch QuickBooks (P-025, P-038, `docs/STRATEGY.md` non-goals), and the build chat still does not use the QuickBooks connector. The new chat may write to QuickBooks only with Max's approval of each batch, starting with one test entry, and asks before any Microsoft 365 read.
- **Open (first batch, for Max and the new chat):** what "push" means (prepare an entry sheet, use the connector's import, or both), which account paid each row, how employee-paid rows are recorded, who decides Equipment and Other rows, and how duplicates and resubmissions are told apart.
- **Not verified:** what the QuickBooks connector can do. From tool names and one tool description (read 2026-10-05, no call made): its transaction import lists no account or attachment field and says it auto-categorizes, so it may not follow the 13-category mapping. All Unverified.
- **Where a change goes:** the briefing first. If a decision needs the app to change (a payment account or class column, a changed category), it goes to `app/src/export/csv.ts` or `app/src/domain/purchaseRules.ts` and then the records here.

---

## Status of strategy items

Items in `docs/STRATEGY.md` labelled **Open** remain open until Max answers. See `docs/QUESTIONS_FOR_MAX.md`.
