# Clarus Purchase Request App: Strategy

**Status:** First draft, written 2026-09-30 during Max Wamsley's overnight build, and updated on 2026-10-01 for the approver-buys build (P-037 to P-042) after Max's answers of that day. Everything Max decided in his build prompt is marked **Decided**. Everything Claude chose where the prompt was silent is marked **Provisional (Claude, awaiting Max)** and is listed in `docs/QUESTIONS_FOR_MAX.md`. Nothing has been installed or changed in Microsoft 365.

**Purpose of this document:** record what carries over from the Travel Expense App, what changes for purchases, the workflow, the output package, the flow design, and the order in which the app is built and finished. `docs/DECISIONS.md` is the formal log (P-001 onward); this document summarises it.

**Labels used throughout**

| Label | Meaning |
|---|---|
| **Decided** | Max decided it (the overnight build prompt, 2026-09-30, or his answers of 2026-10-01; each entry says which) |
| **Carried over** | A Travel Expense App decision (D-number in the travel repository) that applies here unchanged |
| **Provisional** | Claude's choice where the prompt was silent. Built as recommended, listed in `docs/QUESTIONS_FOR_MAX.md`, and changed only if Max chooses differently |
| **Open** | Needs a decision that cannot be made by Claude |
| **Verified** / **Unverified** | For Microsoft licensing, pricing and platform claims: whether Claude opened a source. Microsoft documentation hosts are blocked in this environment, so most platform claims are Unverified |

---

## 1. Purpose and scope

**Goal (Decided):** a Purchase Request app for Clarus Labs employees. It is a near copy of the Travel Expense App, adapted for non-travel purchases. It replaces the current process, in which the F2 Purchase Request and Approval Form is completed in Word and sent through the Purchasing Receipt Team on Microsoft Teams, with the supervisor @-mentioned.

**In scope**
- A purchase request with a header (employee, department, business purpose, project or grant code, and who buys it) and one line per purchase (date, vendor, what was bought and why, amount, category, the item's web page, and, when the employee buys, who paid).
- **The approver buys most purchases (about 95%, the default, P-037).** The employee asks, the approver approves, buys, attaches the receipt and marks it purchased. Every such request goes to the approver, whatever the amount.
- When the employee buys it instead: approval inside the app for any vendor total of $500 or more, with an email to the approver; receipts and invoices attached after buying, with the same receipt suggestions and vendor memory as the travel app (D-074, D-078, D-079); the employee submits.
- On submission: a folder with receipt copies and one CSV in `Accounting/Purchases/Purchases_To_Process`, and an email to the administrator.
- An SOP for employees, approvers and the administrator, written as the app is built.

**Out of scope**
- Travel. Travel purchases go to the Travel app. The Instructions say so.
- Writing to QuickBooks, the tracker and log workbooks, `Clarus_Accounting_SOP.md`, or the chart of accounts. The QuickBooks connector is not used.
- `Accounting/Receipts_To_Process`, and anything that already exists in the Accounting folder. The flow only creates new folders and files inside `Purchases/Purchases_To_Process`.
- The current Power Apps apps and their lists, the travel app and its repository.
- A purchasing policy. Max will write a new one with Claude after the app is complete (section 14, last stage). The old P4 policy is not used and was not looked for.
- Changing Microsoft 365 or Entra ID configuration. Max makes all changes there.

---

## 2. What carries over from the Travel Expense App

Decided: there is no architecture debate for this project. The answer is the same as travel.

| Area | Carried over unchanged | Travel reference |
|---|---|---|
| Platform | SharePoint Framework web part (SPFx 1.23.2, Heft), React 17.0.1, TypeScript 5.8.3, full page on a SharePoint site and in Teams | D-001, D-059 |
| Data | SharePoint lists, employees see only their own items, administrators (site Owners) see all, employees may edit their own items directly, receipts are list attachments | D-002, D-003, D-066 |
| Flow | One Power Automate cloud flow owned by Max, standard connectors only (SharePoint, Office 365 Outlook), delivered as a legacy import package made by the Set-up page. No app registration, no Microsoft Graph, no Azure | D-006, D-047, D-068 |
| Hand-off | The app writes a submission as Uploading, attaches the files, then sets Ready; the flow starts only on Ready, claims the item, creates the folder, copies the files and emails | D-066, D-068 |
| Safety | Destination fixed in code; folder name cleaned again by the flow; nothing overwritten, moved or deleted; stored text never shown as HTML; email summary is plain text escaped by the flow | D-055, D-067 |
| Records | One CSV, dates as `YYYY-MM-DD` text, amounts in whole cents, totals calculated in the app | D-043, D-045, D-048 |
| Certification | A tick box with the certification sentence, recorded with the signed-in account; no signature | D-064 |
| Receipts | PDF, JPG, PNG, HEIC, up to 15 MB, stored as uploaded; one row per dropped file; same-receipt-as-row; duplicate checks | D-038, D-041 |
| Receipt reader | In-browser reader, suggestions marked until confirmed, vendor memory, all files shipped in the app package | D-074, D-078, D-079 |
| Set-up | The app creates its lists from an administrator's Set-up page and never changes a list it did not create | D-063, D-077 |
| Site | A shared "Forms and Apps" site; every Owner is an administrator | D-075 |
| Design | KFA theme, Clarus logo, dark sidebar, header card, totals strip, drop box, grid, automatic saving, Instructions panel built from the SOP text | D-032 to D-036, D-061 |
| Tooling | Vite preview on synthetic sample data, Vitest plus Jest, Playwright screenshot script, GitHub Actions build that keeps the `.sppkg` | D-054, D-062 |
| Working rules | Records updated at every commit, implemented vs tested vs installed kept apart, Verified/Unverified evidence labels, no em dashes, synthetic data only | `CLAUDE.md` of the travel repo |

**Removed because they are travel only (Decided):** trip dates, destination, mileage, GSA rate tables, the daily meal limit, the late-trip warning, the "date outside the trip" warning and the travel categories.

**Changed because purchases differ:** section 3 onward.

---

## 3. What changes for purchases

| Travel | Purchase request |
|---|---|
| A report is one trip | A request is one business purpose, with one or more purchases |
| Trip name, destination, dates, "what was this trip for" | Business purpose (one line, also the request's name), project or grant code (optional, with a quick pick), department |
| Seven travel categories, each with a QuickBooks account | Thirteen purchase categories, each one a QuickBooks account number and name (P-038); the account list is from Max, to be re-exported and compared before go-live |
| Payment type: personal, company card, paid by Clarus | Who buys it: the approver (default) or the employee. When the approver buys, the company pays every row. When the employee buys: Who paid, Company or Employee |
| Submitted reports go straight to the administrator | When the approver buys, every request goes to the approver first, whatever the amount. When the employee buys, a vendor total of $500 or more needs the approver's approval first |
| Receipts are the only attachments | Attachments are receipts, invoices and quotes, each marked with its kind. Each row also has the item's web page (P-039) |
| Statuses: Draft, Submitted, Returned, Processed | Adds Awaiting approval and Approved. Submitted is shown as Purchased when the approver bought it |
| One email per submission | Adds an email to the approver when approval is needed |
| Report number `TR-0042` | Request number `PR-0042` |
| Folder `Accounting/Trips/Trips_To_Process` | Folder `Accounting/Purchases/Purchases_To_Process` |
| Lists `Travel...` | Lists `Purchase...` |

---

## 4. Rules (all in one domain file)

Decided by Max: the certification sentence, the $500 approval threshold and quote rule, the 10% rule, the Owners as approvers, who buys (the approver by default) and the QuickBooks accounts and 13 categories. Carried over from travel: the receipt rule. Recommended by Claude and built, each listed in `docs/QUESTIONS_FOR_MAX.md`: everything else in this table.

Every number and every piece of policy wording lives in `app/src/domain/purchaseRules.ts`, so the new purchasing policy can change them in one place. Tests in `purchaseRules.test.ts` cover each rule.

| Rule | Value | Status |
|---|---|---|
| Who buys | **The approver buys it** (default) or **I will buy it myself**, chosen on each request while it is a Draft or Returned | **Decided** (2026-10-01, P-037) |
| Approval threshold | When the approver buys: every vendor total goes to the approver, whatever the amount. When the employee buys: a vendor total of **$500 or more** in a request needs approval in the app before the purchase, and under $500 needs none (the request is still submitted with receipts) | **Decided** (prompt; 2026-10-01) |
| Quote rule | At **$500 or more**, the approval request also needs a quote, or a written no-quote reason, for both ways of buying. The old form's $100 and "over $500" are retired | **Decided** (2026-10-01, P-015) |
| Item link | Each row has the item's web page, or, when the approver buys, a reason there is none | **Decided** (2026-10-01, P-039) |
| How thresholds count | By **vendor total within a request**, not by line. All lines in a request share one business purpose and one project or grant code, so "the same vendor for the same business purpose" is "the same vendor in the request". Vendor names are matched ignoring capitals, accents, spaces and punctuation, in any alphabet ("Digi-Key" and "DigiKey" are one vendor). A line with no vendor yet counts on its own | Provisional (the prompt says "the same vendor for the same business purpose in a request, not each line") |
| Bought before approval | For a request the employee buys: a $500-or-more vendor total that was already bought when the request is sent for approval is flagged **Bought before approval**. "Already bought" means a line dated before the day it is sent, or a receipt or invoice already attached. It can still be sent. It still needs the approver's approval before processing, and the administrator sees the flag in the email and the CSV. A flag, once set, stays; when a request is sent again after an approval, a vendor total the approval still covers is not newly flagged | Provisional (the prompt describes the behaviour; the test for "already bought" is Claude's) |
| Approval covers what the approver saw | For a request the employee buys: the approver approves each vendor total as shown. Later changes are allowed, but a vendor total that rises more than **10%** above what was approved, or a new vendor total of $500 or more, needs approval again. A request the approver buys stays approved whatever the approver changes while buying | **Decided** (2026-10-01: keep the 10% rule) |
| Certification | "I certify that the listed purchases are for official Clarus Labs business purposes, are not personal expenses, have not been reimbursed elsewhere, and that the information provided is accurate to the best of my knowledge." Ticked by the employee at Submit when the employee buys, and when sending the request when the approver buys (P-041), tied to the account | **Decided** (the form's sentence, exact; the moment, 2026-10-01) |
| Who paid | Asked only when the employee buys: Company, or Employee (employee-paid lines are "To reimburse"). When the approver buys, the company pays every row | **Decided** |
| Categories | The 13 QuickBooks accounts: R&D Materials & Supplies; Equipment; Advertising/Marketing/Website; Computer, H/W & S/W Supplies; Office Supplies; Training and Education; Shipping/Postage; Business Insurance; Dues and Subscriptions; Telephone/Internet; Repairs & maintenance; Professional Services; Other (with a description). Equipment and Other: the administrator decides the account | **Decided** (2026-10-01, P-038) |
| Receipt needed | Every line needs a receipt or invoice, or a no-receipt reason, before Submit (as in travel, D-027) | Carried over |

---

## 5. How it works, end to end

### Employee

1. Opens the app and starts a request (step 1, Request details): business purpose, project or grant code (a quick pick offers "NSF SBIR Phase 1 (Award # 2528301)"; nothing is filled in by default), department, and **Who buys this?** ("The approver buys it" is already chosen). The employee's name comes from the signed-in account. The approver is shown as the site Owners.
2. On step 2, Purchases, adds one line per purchase: date, vendor, what was bought and why, the estimated amount, the category, and the item's web page (or why there is none). A quote is attached for a vendor total of $500 or more, or a reason there is none is given. When the employee buys it, they also say who paid and attach receipts later; files can be dropped in as receipts or invoices (each becomes a row, and the app reads it and suggests the date, amount and vendor, as in travel) or as quotes.
3. On step 3, Review, the employee sees what is needed:
   - **The approver buys it (the usual case):** every request is sent to the approver, whatever the amount. The employee ticks the certification and chooses **Send to the approver**. After that the employee has nothing to do unless the request is returned.
   - **I will buy it myself, under $500 for every vendor:** no approval is needed. The employee buys, attaches receipts and submits, ticking the certification.
   - **I will buy it myself, a vendor total of $500 or more:** the request is sent for approval first. If a purchase was already made, the app says so and flags it. After approval, the employee buys, attaches the receipts and submits.
4. If the approver or the administrator returns the request, the employee sees the note, corrects it and sends or submits again.

### Approver (the site Owners; today, Max)

1. Receives an email with a link when a request is sent.
2. Opens **Approvals** in the app, reads the request, the vendor totals, the item links, the quotes (each file opens in a preview) and any "Bought before approval" flag, and confirms or changes each category.
3. Chooses **Approve**, or **Return with a note**. Approving confirms the categories shown. An approver who is also the requester can approve their own request; it is recorded as self-approved (Decided, 2026-10-01).
4. **When the approver buys it:** approving means buying. The request is in the **To buy** list; **Open to buy** lets the approver change every row to what was bought, add or remove rows (shipping, tax), attach the receipts and invoices, and choose **Mark purchased**. The rows as the employee sent them stay on the page ("As sent for approval"). If the approver cannot buy it, they return it to the employee.

### Flow (section 8 has the detail)

For an approval request: emails the approver. For a submission: creates `Accounting/Purchases/Purchases_To_Process/<request folder>`, copies in the files, marks the submission Packaged and emails the administrator.

### Administrator (site Owners; today, Max)

As in travel: receives the email, opens the folder, processes the receipts with the receipt skill and QuickBooks (outside the app), moves the folder into `Purchases/<year>/`, and marks the request **Processed**. The CSV names the QuickBooks account on each row; for Equipment and Other the administrator decides the account, and Mark processed waits until their categories are confirmed. The administrator can also confirm or change a category (the CSV in the folder keeps the category as submitted), and can return a request with a note. A request the approver bought, returned at processing, goes back to the approver, who fixes it and marks it purchased again.

### Request statuses

| Status | Meaning | Who sets it | Employee can edit |
|---|---|---|---|
| Draft | Being prepared | App (new request) | Yes |
| Awaiting approval | Sent to the approver | App (Send for approval) | No |
| Approved | Approved. When the employee buys: the employee buys, attaches receipts and submits. When the approver buys: the approver buys, attaches the receipts and marks it purchased | Approver | Employee-bought: yes. Approver-bought: no |
| Submitted | Sent for processing; package created. Shown as Purchased when the approver bought it | App (Submit, or Mark purchased) | No |
| Returned | Sent back with a note, by the approver or the administrator | Approver or administrator | Yes |
| Processed | Filed and entered; closed | Administrator | No |

A request the approver buys goes Draft, Awaiting approval, Approved, Submitted (Purchased), Processed. A request the employee buys with every vendor total under $500 goes Draft, Submitted, Processed; with a vendor total of $500 or more, Draft, Awaiting approval, Approved, Submitted, Processed. A return from either stage goes to Returned; the employee corrects it and sends or submits again (the next submission gets an `_R2` folder, D-042). The exceptions: the approver can return an Approved request they were to buy, and the administrator's return at processing sends a request the approver bought back to Approved, for the approver to fix (P-042).

Submission (package) statuses are unchanged: Uploading, Ready, Processing, Packaged, Failed. Each submission also has a type: **Approval request** (no files; the flow only emails the approver) or **Processing package**.

---

## 6. Data model

The full list and column definitions are in `docs/DATA_MODEL.md`. In summary, three lists on the shared Forms and Apps site (Decided): `Lists/PurchaseRequests`, `Lists/PurchaseRequestLines`, `Lists/PurchaseSubmissions`. Every address starts with "Purchase" so the lists can sit beside the travel app's lists and other forms (D-075, D-077). Set-up never changes a list it did not create.

- **Purchase Requests:** request number, business purpose (the item's title), department, project or grant code, who buys it, status, return note and stage, totals (to reimburse, paid by Clarus, request total), submission count, the approval record, the bought-before-approval flag, and who approved and when.
- **Purchase Request Lines:** request link, row, date, vendor, what was bought and why, category (with a description for Other), amount, who paid, item link, no-link reason, no-receipt reason, no-quote reason, same receipt as row, file fingerprints (each file's kind, receipt or quote), suggested-not-confirmed marks, and who confirmed the category.
- **Purchase Submissions:** as in travel, plus a type (approval request or processing package) and frozen approval details. The flow reads and completes it.

---

## 7. Output package

### Location (Decided)

`ExecutiveTeam/Shared Documents/01_Company Documents/Accounting/Purchases/Purchases_To_Process/<request folder>/`. The flow creates only `Purchases`, `Purchases_To_Process` and new request folders. The Set-up page checks, read-only, that `01_Company Documents/Accounting` exists when it builds a Live package, as in the travel app. It never touches `Accounting/Receipts_To_Process` or anything else. The test package sends folders to the test site's own Documents library, `Purchases_Test/Purchases_To_Process`.

### Request folder name (Provisional)

```
YYYY-MM-DD_Employee-Name_Business-Purpose_PR-0042
```

The date is the earliest purchase date in the request, so the year shows where to file the folder (`Purchases/<year>/`). The business purpose is cleaned to letters, digits and hyphens, at most 40 characters. A resubmission adds `_R2`, `_R3` (D-012, D-042).

### Folder contents

| File | Contents |
|---|---|
| Receipt copies | Row number plus the original file name: `R01_IMG_4432.jpg`; a second file on the same row `R01-2_...`; a receipt shared by several rows appears once, under the first row's number |
| Quote copies | `Q01_quote.pdf`, `Q01-2_...`, for quotes attached to a row |
| `PR-0042_Purchases.csv` | One row per purchase line; UTF-8 with a byte-order mark; resubmissions `PR-0042_R2_Purchases.csv` |

### The CSV (Decided: one CSV, with category, suggested account, grant code, approval status and approver)

Purchase columns first, then the repeated request columns (as in travel D-048): Request, Row, Date, Vendor, What was bought and why, Item link, Category, Category confirmed by, QuickBooks account, Amount, Who bought, Who paid, Reimbursable, Project or grant code, Approval status, Bought before approval, Approved by, Approved on, Quote files, Receipt files, No-quote reason, No-receipt reason, No-link reason, Warnings, Submission, Submitted by, Submitted on, Department, Purchase dates, Business purpose, Certified by (31 columns).

**The QuickBooks account** is the number and exact name from the account list Max supplied (P-038); for Equipment and Other the column says what the administrator decides. The mapping is one table in `purchaseRules.ts`, labelled "from the May 1, 2026 account list". **Re-export the account list and compare it before go-live.** There is no class column. The administrator decides the account, as in travel (D-020). The QuickBooks connector is not used.

### Emails (Provisional wording; same plain-text, escaped design as travel, D-046, D-067)

- **Approval email**, to the approvers (the site Owners' addresses, read when the flow package is made): request, requester, department, business purpose, project or grant code, who buys, the vendor totals that need approval (every vendor total when the approver buys), quote status, any Bought before approval flag, and a link that opens the request in the app. The item links are not in the email; the approver opens them in the app.
- **Submission email**, to the administrator: as in travel, with "To reimburse", "Paid by Clarus" and "Request total", rows without receipts, warnings, the approval (who, when, note), the Bought before approval flag, the certification, and who bought it (the approver's name and address when the approver bought).
- **Failure email**, as in travel.

---

## 8. The flow

One flow, as in travel. The approval email is a **branch of the same flow** (Provisional, P-018), not a second flow.

### Fixed settings, held inside the flow (never taken from list data)

| Setting | Value |
|---|---|
| Destination site | `https://claruslabsusa.sharepoint.com/sites/ExecutiveTeam` |
| Library | Shared Documents |
| Destination folder | `01_Company Documents/Accounting/Purchases/Purchases_To_Process` |
| Administrator email | The administrator who makes the package (v1: Max) |
| Approver emails | The site Owners' addresses when the package is made (fallback: the administrator) |

### Steps

| Step | Action |
|---|---|
| Trigger | SharePoint "When an item is created or modified" on Purchase Submissions, condition Package status equals Ready, one at a time |
| 1 | Set the status to Processing (claims the item) |
| 2 | **If the submission's type is "Approval request":** send the approval email, then set Package status to Packaged. On failure, set Failed and email the administrator |
| 3 | **Otherwise (a processing package):** the same steps as the travel flow: clean the folder name, check and create `Purchases` and `Purchases_To_Process` if missing, stop if the request folder exists, create it, copy each attachment, set Packaged, email the administrator. On failure, set Failed and email |

**Why a branch, not a second flow (P-018).** One flow to import, turn on and monitor; one trigger and one set of connections; the approval hand-off gets the same Uploading, Ready, Packaged and Failed protocol and the same Needs attention monitoring as packaging. A second flow would double the import steps and the things that can be turned off. Cost: the flow definition has one more level of nesting. Not chosen: Power Automate's Approvals actions (approval happens in the app, as Max decided); an email sent by the app (the app has no mail access).

**Unverified:** that the branch structure imports and runs as written. The package is checked with the same checker as travel. The travel flow's other points were confirmed at its Stage 8 checkpoint (`flow/FLOW.md` of the travel repository); the approval branch is new and is tested at this project's checkpoint.

---

## 9. Security and permissions

Carried over from the travel app (D-002, D-003, D-066, D-067) with these additions:

- **Approvers are the site Owners** (people with the SharePoint "Manage web site" permission), the same test the travel app uses for administrators.
- **Employees can edit their own list items in SharePoint** (D-002). So an employee could, outside the app, set their own request to Approved. Accepted risk, as in travel: SharePoint version history records who changed what, and the submission email and CSV name the approver and the time, so the administrator can see an approval that does not match the approver's own record. Revisit at the security review (Provisional; Max to confirm).
- **A self-approval** (the approver is the requester) is allowed and shown as such in the record, email and CSV (Provisional).
- The approval email is built from plain text stored by the app and escaped by the flow. The approver's address list is fixed inside the flow package, and the package generator refuses any address, web address or destination it could not carry safely. An employee could still make the flow send an approval email to the Owners with text of their choosing (P-033).
- The services check what they can, because the app cannot stop an employee editing their own items: Approve is refused if the request changed after it was sent, a row or submission counts only if the request's owner made it, and a few more (P-034).
- **When the approver buys (P-040 to P-042):** the approver adds rows and files to the request they approved, and those count on that request only. SharePoint shows people their own items, so the employee does not see them (Unverified, tested at the checkpoint). The employee's certification is kept on their approval request, so it is only as honest as an item the employee can edit (P-041, accepted, like P-029). The item link is the only stored text shown as a link, and only after a web-address check (P-039).
- Commit synthetic data only: fictional vendors and people.

---

## 10. Scale and cost

As in travel: $0 beyond the existing Microsoft 365 licence (Unverified, carried over from the travel strategy); standard connectors only; adding an employee means adding them to the site's Members; adding an approver means adding them as an Owner and making a new flow package from Set-up (the approval email addresses are fixed in the package). Unverified platform limits are carried over from the travel strategy (section 16).

---

## 11. Maintenance with Claude and GitHub

Same repository layout as the travel app:

| Path | Contents |
|---|---|
| `app/` | SPFx solution and the local preview |
| `app/src/domain/` | Every business rule. `purchaseRules.ts` holds the policy numbers and wording |
| `app/src/data/` | The only code that talks to SharePoint, plus the mock for the preview and tests |
| `app/src/export/` | CSV, email text, submission package, flow package |
| `app/src/reading/` | The receipt reader (unchanged from travel) |
| `app/src/ui/` | Screens |
| `flow/` | `FLOW.md`, an example definition, the package checker |
| `.github/workflows/` | The GitHub build |
| `docs/` | This strategy, the SOP, decisions, status, changelog, data model, questions, checkpoint steps |
| `test/fixtures/` | Synthetic receipts and data only |

Testing: unit tests run under Vitest and again under Jest in the SharePoint build; screenshots are taken from the local preview; real SharePoint and flow testing happens on a test site at the checkpoint (`docs/CHECKPOINT.md`).

---

## 12. Visual design

Unchanged from travel (D-032 to D-036): purple primary buttons, dark purple sidebar with the Clarus logo, lavender workspace with white cards, a header card on every page, a totals strip, a large drop box, an automatic-saving grid, an Instructions panel. The app name is **Purchase Requests**.

Changes for purchases (Provisional):
- Three steps: **Request details**, **Purchases**, **Review and send** (or **Review and submit**). The Review step shows the approval state and offers **Send to the approver**, **Send for approval** or **Submit**, whichever applies. Request details asks **Who buys this?**.
- The totals strip shows **To reimburse**, **Paid by Clarus**, **Request total** and a fourth card for what needs attention, or the approval state for a locked request.
- The drop box has a switch: the dropped files are **receipts or invoices** (the default) or **quotes**.
- Each grid row shows its approval status: Not required, Approval needed, Awaiting approval, Approved, or Changed since approval. A purchase that looked already made is flagged **Bought before approval** on the request, in the Approval card and in the approver's and administrator's views.
- Administrator pages: **Approvals** (new, with a **To buy** list), Requests to process, Needs attention, All requests, Set-up. The request page for an approver has Approve and Return, editable categories, the item links, the vendor totals, and, for a request the approver buys, Open to buy and Mark purchased with the rows as sent beside the rows as bought.

---

## 13. SOP

`docs/SOP.md`, started with the build and kept current. Part A (employees) is generated from the in-app Instructions text, as in travel (D-061). Part B covers the approver and the administrator, Part C troubleshooting. The Instructions say that travel purchases go to the Travel app and that the old Teams form is replaced.

---

## 14. Stage plan

Each stage ends with a commit on the project branch and an entry in `docs/CHANGELOG.md`, all under one draft pull request. Nothing is merged, deployed or changed in Microsoft 365 without Max's approval.

| Stage | Output | State |
|---|---|---|
| 1. Read and records | This document, `CLAUDE.md`, `docs/DECISIONS.md`, `STATUS.md`, `CHANGELOG.md`, `DATA_MODEL.md`, `SOP.md`, `QUESTIONS_FOR_MAX.md` | Overnight build |
| 2. Copy | The travel app, tooling and CI under the new name and new IDs | Overnight build |
| 3. Rules | `purchaseRules.ts` and the domain rules, with tests | Overnight build |
| 4. Data | The data model, SharePoint lists, mapping, mock and SharePoint services, fake SharePoint tests | Overnight build |
| 5. Screens | Request, lines grid, approver screens, administrator screens, Set-up | Overnight build |
| 6. Export and flows | CSV, email text, submission package, approval email, Test and Live flow packages, `flow/FLOW.md` | Overnight build |
| 7. Checks | Preview sample data, screenshots, Instructions, SOP Part A, full build | Overnight build |
| 8. Checkpoint steps | `docs/CHECKPOINT.md` | Overnight build |
| 9. Morning report | `docs/STATUS.md`, the draft pull request | Overnight build |
| 10. Review | Max answers `docs/QUESTIONS_FOR_MAX.md`; Claude makes the changes. On 2026-10-01 Max answered questions 1 to 5 and 24 to 29, and Claude built the approver-buys workflow, the item link and the 13 QuickBooks categories (P-037 to P-042); the new questions 30 to 32 wait for him | Max and Claude |
| 11. Test-site checkpoint | Max installs on a test site from `docs/CHECKPOINT.md` and runs a request through, including approval | Max |
| 12. Security review and SOP proof pass | Permissions, flow safety, repository check; SOP read against the built app | Claude and Max |
| 13. Pilot | Production site and flow, used on real purchases by a few employees | Max |
| 14. Production | Teams app; the Word form and the Teams posting are retired when Max decides | Max |
| 15. **New purchasing policy (last stage)** | Max writes a new purchasing policy with Claude. The thresholds, quote rule, categories, certification sentence and account mapping in `purchaseRules.ts` are changed to match, in one place; the Instructions, SOP and the form text are updated. Inputs already decided (2026-10-01, `docs/SOP.md` "Rules confirmed by Max"): $500 for approval and the quote rule, the old form's $100 retired, the Owners approve, the 10% rule, the approver buys by default, the QuickBooks accounts. Still to settle: where Equipment is capitalized rather than expensed | Max and Claude |

---

## 15. What the first version will not do

- Write to QuickBooks, the tracker, the receipt log or `Receipts_To_Process`.
- Rename, move or delete anything in the Accounting folder. The only writes are new folders and files inside `Purchases/Purchases_To_Process`.
- File requests into year folders (the administrator does this).
- Handle travel.
- Enforce a purchasing policy beyond the rules in section 4. The policy is written last (section 14).
- Let an employee withdraw a request that is awaiting approval (the approver returns it).
- Count a vendor across different requests. A threshold applies within one request (Provisional; a question for Max).
- Send the employee an email. The app shows the status (as in travel, D-046).

---

## 16. Open decisions

Every open or provisional choice is in `docs/QUESTIONS_FOR_MAX.md`, numbered, with options, a recommendation, and where the change would go. The first five to answer are listed at the top of that file.

---

## 17. Evidence for platform claims

Microsoft's documentation sites are blocked in this environment. Claims below marked Unverified come from Claude's knowledge or from the travel project's evidence table (`docs/STRATEGY.md` section 16 of the travel repository), which was not re-checked on 2026-09-30.

| Claim | Source | Evidence |
|---|---|---|
| Everything in section 16 of the travel strategy (licensing, SPFx, SharePoint limits, flow limits, import format, action formats) applies here | Travel repository, commit b1af343, dated 2026-09-24 to 2026-09-29 | Carried over; each row keeps its own label there. Not re-checked |
| The travel packaging flow imported and ran on a real test site, including the `_R2` resubmission | Max's Stage 8 checkpoint, 2026-09-28 and 2026-09-29, recorded in the travel `docs/STATUS.md` | Confirmed for travel. Not yet for this project |
| The site Owners group's members can be read with `web/AssociatedOwnerGroup/users` by an administrator | Claude's knowledge of the SharePoint REST interface; not checked | Unverified. The Set-up page falls back to the administrator's own address, and the employee screens show the generic label "Site Owners" instead of "Site Owners (names)" |
| A nested scope with its own failure scope inside a condition branch works in a legacy import package | Standard Power Automate and Logic Apps structure; not checked against a package | Unverified. The import and the branch are tested at the checkpoint; the failure scope is not (`docs/CHECKPOINT.md` step 34) |
| The F2 form's wording ($100 approval, "over $500" quote) is old policy and is not used | The attached form itself, read 2026-09-30 | Confirmed (what the form says). Which thresholds Max wants is decided in his prompt and recorded as P-005 |
| QuickBooks account numbers and names per category | Max's message of 2026-10-01, from his reading of the May 1, 2026 account list (Claude did not open the file) | Max's information. Re-export the account list and compare it with `purchaseRules.ts` before go-live |
| SharePoint's own-items-only permission hides rows the approver adds from the employee | Claude's knowledge of SharePoint item-level permissions; not checked | **Unverified.** Tested at the checkpoint (`docs/CHECKPOINT.md`) |

---

## 18. Environment notes

- Node.js 22.22.0 and npm are available; npm and GitHub are reachable. Microsoft hosts are blocked.
- The Microsoft 365, Outlook, Teams, SharePoint and QuickBooks connectors were not used during the overnight build.
- The source repository `MaxWamsley-ClarusLabs/clarus-travel-expense` (branch `claude/travel-expense-evaluation-uo38kg`, commit b1af343) was cloned read-only. Nothing was written, committed or opened there.

---

## Revision history

| Date | Change |
|---|---|
| 2026-09-30 | First draft, written during the overnight build from Max's prompt and the F2 form |
| 2026-10-01 | Reconciled with the built app at the end of the overnight build: the stage table, the screens, the flow's structure (`flow/FLOW.md`) and the Owners label |
| 2026-10-01 | The approver-buys build (P-037 to P-042): who buys, the item link, the 13 QuickBooks categories, the approver's buying screens, the certification at send, the 31-column CSV |
