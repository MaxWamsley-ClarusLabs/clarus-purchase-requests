# Decisions log

Every project decision, newest last. Each entry gives the date, the decision, the options considered, and why the others were rejected. "Max" is Max Wamsley, CEO, who approves all decisions.

**Status labels**
- **Decided (Max):** Max decided it in his overnight build prompt of 2026-09-30.
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
- **Status:** Decided (Max)
- **Decision:** Under $500: no approval is needed, but the employee still submits the request with receipts. $500 or more: needs approval in the app before the purchase.
- **Note:** The attached F2 form (P4 wording) still says that purchases of $100 or more need approval and that purchases over $500 need a quote. Max's prompt decides $500 for approval, and the form's $100 is not used. The form text is one of the things the new policy stage updates. Listed as a question so Max sees it.

## P-006. Workflow and statuses

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** 1. Request: the employee creates a request with the planned purchases. 2. Approval: if any vendor-and-purpose total is $500 or more, the request goes to the approver. The approver gets an email with a link; in the app, the approver can Approve (and confirm categories) or Return with a note. A request under $500 skips this step. 3. Receipts: after buying, the employee attaches receipts and invoices, with receipt suggestions as in travel, then submits. 4. Processing: as in travel, the flow places a folder with receipt copies and a CSV in the destination and emails the administrator. The travel status model (Draft, Submitted, Returned, Processed, `_R2` resubmissions) is reused, with the approval states added. Approvers are the site Owners (the travel D-066 pattern); for now that is Max.

## P-007. Where it lives

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** The shared "Forms and Apps" site (travel D-075). All list addresses start with "Purchase": `Lists/PurchaseRequests`, `Lists/PurchaseRequestLines`, `Lists/PurchaseSubmissions`. Set-up leaves other lists alone (travel D-077).

## P-008. Flow destinations

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** The Test flow package sends folders to the test site's own Documents library, `Purchases_Test/Purchases_To_Process`. The Live destination is `ExecutiveTeam/Shared Documents/01_Company Documents/Accounting/Purchases/Purchases_To_Process`. The flow creates only `Purchases`, `Purchases_To_Process` and new request folders, never touching anything else, and keeps the travel flow's read-only check that `01_Company Documents/Accounting` exists. It never touches `Accounting/Receipts_To_Process`. The destination is fixed in code, never taken from list data. The flow uses standard connectors only.

## P-009. One CSV, with the accounting suggestions

- **Date:** 2026-09-30
- **Status:** Decided (Max)
- **Decision:** A single CSV like travel D-044 to D-053, with the category, a suggested QuickBooks account per category, the grant code, the approval status and the approver. The account mapping is marked "Unverified, to confirm with Max" in the code and the records. The QuickBooks connector is not used.

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
- **Status:** Decided (Max)
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

The first three are the default rules Max asked to have built and listed.

## P-015. Quote rule: $500 or more

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max). Max's prompt names this as a recommended default to build and list.
- **Decision:** A vendor total of $500 or more also needs a quote, or a written no-quote reason, attached to the approval request. A quote is a file marked "quote" on one of the vendor's lines; the reason is text on one of those lines. The threshold is a separate constant from the approval threshold, so the two can differ.
- **Options considered:** "over $500" (above $500, which is what the attached F2 form says); a higher quote threshold; no quote rule; a quote required with no reason allowed. Chosen because Max wrote "$500 or more" and using the same number for both keeps the rule easy to explain.
- **Where a change goes:** `QUOTE_THRESHOLD_CENTS` and the comparison in `purchaseRules.ts`; wording in `messages.ts`.

## P-016. How thresholds count: vendor total within a request

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max). Max's prompt names this as a recommended default.
- **Decision:** A threshold applies to the total from the same vendor within a request, not to each line, so a purchase cannot be split across lines to avoid approval. A request has one business purpose and one project or grant code, so "the same vendor for the same business purpose in a request" is "the same vendor in the request". Vendor names are matched ignoring capitals, spaces and punctuation ("Amazon", "amazon." and "AMAZON" are one vendor). A line with no vendor yet is counted on its own. Every line counts, whoever paid.
- **Options considered:** per line (easy to avoid by splitting); per vendor across all of an employee's requests in a period (catches splitting across requests, but needs a rule for the period and a way to explain it; not built, see the question); per vendor and per a business purpose typed on each line (the purpose would be free text, so matching would be unreliable).
- **Where a change goes:** `vendorGroups` in `purchaseRules.ts`; the request header (`docs/DATA_MODEL.md`) if a purpose per line is wanted.

## P-017. Bought before approval

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max). Max's prompt names this as a recommended default.
- **Decision:** A purchase of $500 or more already made without approval can still go through. When the request is sent for approval, a vendor total of $500 or more is flagged **Bought before approval** if any of its lines is dated before the day it is sent, or already has a receipt or invoice attached. The request still goes to the approver first. The flag stays on the request after approval. The administrator sees it in the submission email and in the CSV (a "Bought before approval" column). The employee submits for processing after the approval, as for any approved request.
- **Options considered:** block the request (Max said it can still be submitted); let the employee submit straight to processing while approval is pending (the folder and CSV would be made before the approval exists, so the CSV would be out of date after approval); ask the employee to tick "already bought" (an honest answer is needed; the date and receipt tests need no extra click). Chosen: two steps, send for approval flagged, then submit, because the folder and CSV are then built once with the approval in them.
- **Where a change goes:** `isAlreadyBought` and `flagBoughtBefore` in `purchaseRules.ts`; the wording in `messages.ts`; the send dialog in `RequestWorkspace`.

## P-018. The approval email is a branch of the same flow

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max). Max asked Claude to choose and explain.
- **Decision:** One flow. The app records each request for approval as a Purchase Submissions item of type **Approval request**, written Uploading and then Ready like a package. The flow starts on Ready, claims the item, and branches on the type: an approval request only emails the approvers and is marked Packaged (shown in the app as "Approver emailed"); a processing package is handled exactly as in the travel flow. The approvers' addresses are the site Owners' addresses read by Set-up when it makes the flow package, with the administrator's own address as the fallback.
- **Options considered:**
  - A second flow triggered by the requests list: a second import, a second trigger to keep turned on, and no shared monitoring of failures. Not chosen.
  - Power Automate's Approvals actions: the approval happens in the app as Max decided; it adds another connector surface. Not chosen.
  - A live lookup of the Owners group inside the flow on each run: more actions to verify and to fail; the addresses change rarely. Not chosen; adding an approver means adding them as an Owner and making a new package from Set-up (the same as changing the administrator's address in travel, travel D-029).
- **Cost:** the flow definition has one more level of nesting than the travel flow. The package is checked with the same checker; the branch is tested at the checkpoint.
- **Where a change goes:** `app/src/export/flowPackage.ts`, `flow/FLOW.md`, `SubmissionType` in `docs/DATA_MODEL.md`.

## P-019. Approval covers what the approver saw

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** When the approver approves, the app records each vendor total of $500 or more as approved at that amount. The employee may change the request afterwards (actual prices differ from planned ones). A vendor total that is now more than 10% above its approved amount, or a vendor total of $500 or more that was not approved, needs approval again: Submit is blocked with a message, and the employee uses Send for approval again. Amounts below the approved amount never need approval again.
- **Options considered:** no check after approval (an approved request could be edited to any amount); no allowance (a small tax or shipping difference would need a second approval); a fixed dollar allowance. The 10% is a guess.
- **Where a change goes:** `OVERRUN_TOLERANCE_PERCENT` in `purchaseRules.ts`.

## P-020. One role for approver and administrator; self-approval; no withdrawing

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** The approver and the administrator are the same role for now: people with SharePoint's "Manage web site" permission, which site Owners have (travel D-066). An approver who is also the requester may approve their own request; the record, the email and the CSV say it was self-approved. An employee cannot withdraw a request that is awaiting approval; the approver returns it.
- **Options considered:** a separate approver list (no place to keep it without a fourth list or code changes; travel D-029 and O14 left this for later); no self-approval (Max is the only Owner, so his own requests could never be approved); a Withdraw button (more states and an email that has already gone out).
- **Where a change goes:** `SharePointDataService.requireAdmin` and `MockDataService`; `selfApproved` in `purchaseRules.ts`.

## P-021. Attachments have a kind: receipt or quote

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** Each attached file is a **receipt** (which includes invoices) or a **quote**. The kind is stored with the file's fingerprint on the line (`FileFingerprints`). The drop box has a switch, and the row menu offers "Attach a quote" and "Attach a receipt or invoice". A line has a receipt only if it has a receipt file (or shares another row's). In the folder, receipt copies are `R01_...` and quote copies are `Q01_...`. The receipt reader reads receipt files only; quotes are typed.
- **Options considered:** one untyped list of files (a quote would count as the receipt, so Submit could pass with no receipt); typing by the request's stage (wrong for a purchase already made); a separate list for quotes (more lists to create and permission). The kind per file is the smallest change that keeps "Receipt attached: yes or no" true.
- **Where a change goes:** `ReceiptFile.kind` in `types.ts`, `naming.ts`, `mapping.ts`, the grid and drop box.

## P-022. Request header details

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** The business purpose is one line of text and is also the request's name (the list item's title, shown in lists, folder names and email subjects). The project or grant code is a separate optional field, with quick picks from `PROJECT_QUICK_PICKS` (today one: "NSF SBIR Phase 1 (Award # 2528301)"), never filled in by default. Department is required, typed once, suggested from the employee's earlier requests, and filled in from their latest request when a new request is created. Purchase date(s) are not typed: they are the earliest and latest dates on the lines. The date submitted is set at Submit.
- **Options considered:** a separate short request name (one more field for every request); a business purpose and a project code as one field as on the paper form (the CSV needs the grant code on its own); a fixed list of departments (Max has not given one).
- **Where a change goes:** `docs/DATA_MODEL.md`, `purchaseRules.ts` (`PROJECT_QUICK_PICKS`), `validation.ts`, the Request details step.

## P-023. Who paid: Company or Employee

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max) for the defaults; the two choices are Decided (Max, P-003)
- **Decision:** Two choices: Company and Employee. Employee-paid lines are "To reimburse". The first row of a request starts as Company and each new row copies the row above, and vendor memory remembers who paid last time (travel D-057, D-078). The travel app's "Suggested payment account" CSV column is dropped, because "Company" does not say which account paid.
- **Options considered:** no default, so every row needs a choice (more clicks); the default Employee (Max has not said which is more common).
- **Where a change goes:** `FIRST_ROW_PAID_BY` in `defaults.ts`; `CSV_COLUMNS` in `csv.ts`.

## P-024. Categories: the Other description and who confirmed a category

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** Choosing Other needs a short description of the category (the form's "Other: ____"), kept apart from "what was bought and why". Each line records who last confirmed or changed its category (the approver when approving, or the administrator later). The CSV has a "Category confirmed by" column, empty when only the employee has suggested the category. The approver or administrator can confirm or change categories while a request is Awaiting approval, Approved or Submitted (`CONFIRMABLE_STATUSES` in `statuses.ts`); approving confirms every category shown. The administrator's change after submission is saved in the app, but the CSV already in the folder keeps the category as submitted.
- **Options considered:** rewriting the CSV after processing (a second write into Accounting, travel D-050 rejected the same idea); no record of who confirmed (Max asked for confirm or change by the approver or administrator).
- **Where a change goes:** `CategoryOther` and `CategoryConfirmedBy` in `docs/DATA_MODEL.md`; `confirmCategories` in the data services.

## P-025. Suggested QuickBooks accounts: names only, Unverified

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max). The mapping is **Unverified, to confirm with Max**.
- **Decision:** Plain account names without numbers: R&D Materials and Supplies; Advertising and Marketing; Computer and Software; Office Supplies; Training and Education; Shipping and Postage; Insurance; and none for Other (the administrator decides). Claude cannot look up the chart of accounts, because the QuickBooks connector is not used and account names in the travel repository cover travel only. Invented account numbers would look verified, so none are given. The CSV's "Suggested payment account" and "Suggested class" columns of the travel app are not carried over.
- **Options considered:** numbers with names (would be invented); leaving the column empty (Max asked for a suggestion); a class from the project code (the travel app's D-050 list maps a trip purpose, not a grant code; Max asked only for the grant code in the CSV).
- **Where a change goes:** `CATEGORIES[].suggestedAccount` and `QUICKBOOKS_MAPPING_STATUS` in `purchaseRules.ts`.

## P-026. Naming and the CSV columns

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** Request number `PR-0042`. Folder `YYYY-MM-DD_Employee-Name_Business-Purpose_PR-0042` using the earliest purchase date, `_R2` for resubmissions. The CSV is `PR-0042_Purchases.csv` (`PR-0042_R2_Purchases.csv`). Columns: Request, Row, Date, Vendor, What was bought and why, Category, Category confirmed by, Suggested QuickBooks account, Amount, Who paid, Reimbursable, Project or grant code, Approval status, Bought before approval, Approved by, Approved on, Quote files, Receipt files, No-quote reason, No-receipt reason, Warnings, Submission, Submitted by, Submitted on, Department, Purchase dates, Business purpose, Certified by. The category is the category as submitted; "Approved by" names the approver (or the requester, marked self-approved).
- **Options considered:** filing by the submission date (an old purchase submitted late would land in the wrong year); splitting the CSV in two (Max prefers one CSV, travel D-045).
- **Where a change goes:** `naming.ts`, `CSV_COLUMNS` in `csv.ts`, `docs/STRATEGY.md` section 7.

## P-027. Who can edit a request, and when

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** The employee can edit a request that is Draft, Returned or Approved. A request that is Awaiting approval, Submitted or Processed is locked (travel D-042). An Approved request stays editable because receipts and real prices arrive after the approval; P-019 keeps the approval honest. Returning a request after processing keeps its approval if nothing changed beyond P-019's allowance.
- **Options considered:** lock after approval (receipts could not be attached); reopen approval on any edit (too many approvals).
- **Where a change goes:** `isEditable` in `statuses.ts`.

## P-028. Certification only at Submit

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** The certification is ticked at Submit, not when a request is sent for approval. Sending for approval needs no tick, because planned purchases have not been made or reimbursed yet; the certification covers what was actually bought.
- **Options considered:** certifying at both steps (two ticks; the sentence talks about purchases that "have not been reimbursed elsewhere").
- **Where a change goes:** `sendForApproval` in the data services and the send dialog.

## P-029. Accepted risk: an employee could mark their own request Approved in SharePoint

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max); follows travel D-002
- **Decision:** Employees can edit their own list items directly (travel D-002), so someone could set their own request to Approved outside the app. The administrator's review and SharePoint version history are the control, as in travel, and the submission email and CSV name the approver and the approval time. Revisit at the security review.
- **Options considered:** a tamper check that compares the approval with the approver's own records (needs the approval stored where employees cannot write; a fourth list and a second permission model); accepting the risk as in travel.
- **Where a change goes:** a security review item in `docs/STATUS.md`.

## P-030. Needs attention covers approval emails

- **Date:** 2026-09-30
- **Status:** Provisional (Claude, awaiting Max)
- **Decision:** An approval request whose email was not sent within 30 minutes, or whose sending failed, appears under Needs attention like a failed package, with Retry. Only the newest approval request of a request that is still Awaiting approval, and the newest package of a request that is still Submitted, are listed: once the request has moved on (approved in the app anyway, returned, processed) a stuck submission no longer matters and is not shown. The sidebar shows a count on **Approvals** (requests awaiting approval), **Requests to process** and **Needs attention**.
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
- **Decision:** The request is made in three steps, as in travel: Details, Purchases and Review. The Purchases step has the drop box (with a Receipts or invoices / Quotes switch), the grid and a **Vendor totals** table that shows, for each vendor, the total, whether it needs approval, and whether it has a quote. The Review step lists what to fix, then a card for the approval (what needs approval, and what changed since it was approved). Send for approval and Submit are two different buttons; the one that applies is the one that is enabled. The "No quote: say why" box appears on the first row of a vendor total of $500 or more while the request is waiting to be sent, and the "No receipt" box appears once approval is done. A request that is Approved opens again for receipts and real prices (P-027). The administrator's side has an **Approvals** page (requests awaiting approval), and one request page with tabs (Purchases, Vendor totals, Approval email, Submission email, CSV file, Folder contents). While a request awaits approval, each category there is a drop-down; Approve confirms the categories shown, says how many were changed, and takes an optional note; Return needs a note. A returned request says who returned it (approver or administrator) and shows the note. Every wording is in `messages.ts` and `content/instructions.ts`.
- **Options considered:** one screen for everything (a long page to scroll on a laptop); the approver approving each line (Max decided approval is by request; thresholds count by vendor total, P-016); a separate approver app (a second web part).
- **Where a change goes:** `app/src/ui/` (`RequestWorkspace.tsx`, `PurchaseGrid.tsx`, `VendorTotals.tsx`, `pages/admin/AdminRequestPage.tsx`); screenshots in `docs/prototype/`.

---

## Status of strategy items

Items in `docs/STRATEGY.md` labelled **Open** remain open until Max answers. See `docs/QUESTIONS_FOR_MAX.md`.
