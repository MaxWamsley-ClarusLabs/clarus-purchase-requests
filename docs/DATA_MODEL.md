# Data model

**Status:** Updated 2026-10-01 for the approver-buys build (P-037 to P-042 in `docs/DECISIONS.md`). Built and tested against an in-memory fake of SharePoint; not yet created on a real site. The app creates the lists from its Set-up page (travel D-063); the definitions it uses are in `app/src/data/sharepoint/schema.ts` and must match this page.

**List addresses (Decided, P-007):** `Lists/PurchaseRequests`, `Lists/PurchaseRequestLines` and `Lists/PurchaseSubmissions` on the shared Forms and Apps site, shown as Purchase Requests, Purchase Request Lines and Purchase Submissions. Every address starts with "Purchase" because the site is shared with the travel app and other forms (travel D-075, D-077). The app finds each list by its address, so renaming a list's title in SharePoint does not break it. The Set-up page never changes a list it did not create: a list at one of these addresses without the app's description ("Purchase Requests app:") or its own columns is left alone and reported as "Address in use".

Three new lists. The travel app's lists and the current Power Apps apps' lists are not touched.

**Guiding rule (travel D-037):** ease of use comes before extra capability. The normal path is simple: add a purchase, fill in the row, attach the receipt, submit. Less common options sit in a small menu on each row.

---

## Common settings for all three lists

| Setting | Value | Why |
|---|---|---|
| Item-level permissions | Read items created by the user; create and edit items created by the user | Employees see only their own records (travel D-003; Unverified: the travel app's colleague test was still open, so this has not been checked on a real site, and this project's step 33 is the first check). Site Owners (approvers and administrators) see everything |
| Version history | On, "create a version each time you edit" | The audit trail for direct edits (travel D-002) and automatic saving. It is also the check on an approval edited outside the app (P-029) |
| Title column | Not required at list level; filled in automatically by the app | The app checks required fields itself, so a half-finished draft can be saved |
| Attachments | On | Receipts, quotes and package files are stored as list attachments, so they follow the item's permissions (Unverified for the approver reading an employee's attachment and for an Owner attaching to an employee's row; checked at the test-site checkpoint) |
| Whose rows | A row or a submission belongs to a request only if the request's owner created it. For a request the approver buys, the approver recorded in ApprovedBy also counts (P-042) | A row or submission that names someone else's request by number (anyone can type a number) is ignored everywhere in the app, so nobody can add a purchase to another person's request. The approver adds rows and submissions to the request they approved while buying, so theirs count on that request only |

**Dates** are stored as text in the form `YYYY-MM-DD`, not as SharePoint date columns, which shift by a day through time zones (travel D-043). **Amounts** are stored in currency columns with two decimals; all totals are calculated in whole cents in the app.

---

## List 1: Purchase Requests (one item per request)

| Column (internal name) | Shown as | Type | Required to submit | Indexed | Notes |
|---|---|---|---|---|---|
| Title | Business purpose | Single line of text | Yes | | One line. Also the request's name in lists, folder names and emails (P-022) |
| RequestNumber | Request number | Single line of text | Set by app | | `PR-` plus the item ID padded to four digits, for example `PR-0042`. Written by the app right after the request is created, for people viewing the list. The app itself shows the number made from the item ID, so an edited or empty column changes nothing |
| Department | Department | Single line of text | Yes | | Filled in from the employee's latest request when a request is created (P-022) |
| ProjectCode | Project or grant code | Single line of text | No | | For example "NSF SBIR Phase 1 (Award # 2528301)", offered as a quick pick, never filled in by default |
| Buyer | Who buys | Choice: The approver buys it, I will buy it myself | Set by app | | Default "The approver buys it" (P-037). The employee chooses while the request is a Draft or Returned; the services refuse a change at any other status, and a change on a returned request takes back any approval it held. A value that is not one of the two is read as the default, so a bad edit cannot turn the approval rule off |
| RequestStatus | Status | Choice: Draft, Awaiting approval, Approved, Submitted, Returned, Processed | Set by app | Yes | Default Draft |
| ReturnNote | Return note | Multiple lines of plain text | | | Written by the approver or the administrator when returning |
| ReturnStage | Returned at | Choice: Approval, Processing | | | Whether the return came at the approval step or at processing; wording only |
| TotalReimburse | To reimburse | Currency | Set by app | | Sum of lines the employee paid. Always zero when the approver buys (P-037) |
| TotalCompany | Paid by Clarus | Currency | Set by app | | Sum of lines the company paid. Every line, when the approver buys |
| TotalRequest | Request total | Currency | Set by app | | |
| SubmissionCount | Submissions | Number | Set by app | | Processing packages so far; 0 until first submitted; used for the `_R2` folder suffix |
| ApprovalRounds | Approval requests | Number | Set by app | | How many times the request has been sent for approval |
| SentForApprovalOn | Sent for approval | Date and time | Set by app | | Last time it was sent |
| BoughtBeforeApproval | Bought before approval | Yes/No | Set by app | | Default No. Set when the request is sent for approval and a vendor total of $500 or more was already bought (P-017). Never set when the approver buys (P-037) |
| ApprovalRecord | Approval record | Multiple lines of plain text | Set by app | | JSON: the vendor totals when last sent (with the bought-before flag for each), the totals approved now, and the newest approval of each vendor from earlier rounds (`earlier`: kept through a return at the approval step, used only for the bought-before-approval test). A record without `earlier` reads as having none; each key is recomputed from its vendor when read. `rows` (P-040): when the approver buys, the rows as the employee sent them (row number, date, vendor, what, category as written, amount, item link, no-link reason; text and numbers only, never shown as HTML), replaced each time the request is sent and kept only when there are some. Read back defensively (an employee may edit their own item, travel D-002) |
| ApprovalNote | Approval note | Multiple lines of plain text | | | The approver's optional note |
| ApprovedOn | Approved | Date and time | Set by app | | |
| ApprovedBy | Approved by | Person | Set by app | | The approver. If the approver is the requester, the app shows "self-approved" (P-020). When the approver buys, this person is the one who buys it and the only person besides the owner whose rows count on the request (P-040, P-042) |
| SubmittedOn | Submitted | Date and time | Set by app | | Last submission |
| ProcessedOn | Processed | Date and time | Set by app | | |
| ProcessedBy | Processed by | Person | Set by app | | |
| Author (built in) | Created by | Person | | Yes | The request owner: the person who creates it, who is also the employee named on the request |

There is no separate requester field (travel D-039). The purchase dates are not stored: they are the earliest and latest line dates.

---

## List 2: Purchase Request Lines (one item per purchase)

| Column (internal name) | Shown as | Type | Required to submit | Indexed | Notes |
|---|---|---|---|---|---|
| Title | Row label | Single line of text | Set by app | | For example `PR-0042 row 3`, for anyone viewing the list directly |
| RequestId | Request | Number | Yes | Yes | ID of the Purchase Requests item |
| RowNumber | Row | Number | Set by app | | 1, 2, 3 in the order shown in the grid |
| PurchaseDate | Date | Single line of text | Yes | | `YYYY-MM-DD`, years 2000 to 2099 |
| Vendor | Vendor | Single line of text | Yes | | Vendors with the same name (ignoring capitals, accents, spaces and punctuation, in any alphabet) add up for the thresholds (P-016) |
| Description | What was bought and why | Single line of text | Yes | | Item or service and a short business reason |
| Category | Category | Choice (13 categories, each one a QuickBooks account, `purchaseRules.ts`, P-038) | Yes | | Suggested by the employee; confirmed or changed by the approver or administrator |
| CategoryOther | Other category | Single line of text | Only for Other | | Says what kind of expense it is (the form's "Other: ____"). Choosing another category clears it |
| CategoryConfirmedBy | Category confirmed by | Single line of text | | | Name of the approver or administrator who confirmed or changed the category; empty while it is only the employee's suggestion |
| Amount | Amount | Currency | Yes, greater than zero | | US dollars as charged, up to $10,000,000.00. A comma is read only as a thousands separator ("1,234.56"), so "12,50" is refused rather than read as 1,250.00 |
| PaidBy | Who paid | Choice: Company, Employee | Yes, when the employee buys | | "Employee" lines are reimbursed; worked out from this in the app, not stored. When the approver buys nobody is asked: the company pays every row, the service keeps the value as Company, and the totals and the CSV count the company as the payer whatever is stored (P-037) |
| NoQuoteReason | No-quote reason | Single line of text | Only when the vendor total is $500 or more and no quote is attached | | |
| NoReceiptReason | No-receipt reason | Single line of text | Only if the row has no receipt at Submit | | |
| ItemLink | Item link | Multiple lines of plain text | When the approver buys: this, or a no-link reason | | The web address of the item, so the approver can open it and buy (P-039). Kept whole up to 2,000 characters; one more is kept so the check can refuse a longer one. Only an address that starts http:// or https://, has a dotted host name, has no spaces and carries no user name or password becomes a clickable link; anything else is shown as plain text and refused. Not in the emails; in the CSV |
| NoLinkReason | No-link reason | Single line of text | When the approver buys and there is no item link | | "No web page, because ..." (P-039) |
| SameReceiptAsRow | Same receipt as row | Number | | | Set from the row menu when one receipt covers several rows (travel D-038) |
| FileFingerprints | File fingerprints | Multiple lines of plain text | Set by app | | JSON: for each attached file, its name, size, a SHA-256 fingerprint, and its **kind** (receipt or quote, P-021). A file with no recorded kind is treated as a quote and never counts as the receipt; if the kind cannot be recorded when a file is attached, the file is removed again |
| SuggestedFields | Suggested, not confirmed | Single line of text | Must be empty | | Values the app filled in from a receipt or vendor memory that the employee has not confirmed, for example `date,vendor,amount` (travel D-078) |

**Defaults (P-023):** when the employee buys, a new row's Who paid is the row above's, or Company for the first row; Category is filled from the last time the employee used the same vendor, when empty. When the approver buys, Who paid is not shown and vendor memory leaves it alone (P-037).

**The categories (P-038):** R&D Materials & Supplies (6182), Equipment (6175, or capitalized to 1415 Fixed Assets:Equipment: the administrator decides), Advertising/Marketing/Website (6500), Computer, H/W & S/W Supplies (6178), Office Supplies (6180), Training and Education (6155), Shipping/Postage (6184), Business Insurance (6215), Dues and Subscriptions (6150), Telephone/Internet (6185), Repairs & maintenance (6170), Professional Services (6050) and Other (no account; the administrator decides). The list is in `purchaseRules.ts`; the account numbers and names come from Max's message of 2026-10-01 and are to be re-checked against the exported account list before go-live.

**Files (P-021)**
- A row's files are its attachments. Each is a **receipt** (this includes invoices) or a **quote**. Dropping several files creates one row per file, all of the kind chosen on the drop box.
- From the row menu, an employee can attach a quote, attach a receipt or invoice, or mark a row "Same receipt as row N". A shared receipt is stored once, on the first row. Quotes are never shared. A row either holds its own receipt files or points at another row, never both: pointing a row that has a receipt is refused, and attaching a receipt to a row that points at another row takes the pointer off.
- A row counts as having a receipt if it has a receipt file, or points to a row in the same request that has one. Otherwise it needs a no-receipt reason before Submit. A quote never counts as a receipt.
- Accepted files: PDF, JPG or JPEG, PNG, HEIC. Up to 15 MB each. Stored exactly as uploaded.

---

## List 3: Purchase Submissions (one item per approval request or submission; created by the app, completed by the flow)

| Column (internal name) | Shown as | Type | Set by | Indexed | Notes |
|---|---|---|---|---|---|
| Title | Label | Single line of text | App | | For example `PR-0042 submission 2` or `PR-0042 approval 1` |
| RequestId | Request | Number | App | Yes | |
| SubmissionType | Type | Choice: Approval request, Processing package | App | | Default Processing package. The flow branches on this (P-018) |
| SubmissionNumber | Submission | Number | App | | For a package: 1 for the first, 2 after a return. For an approval request: the round, 1, 2 |
| PackageStatus | Package status | Choice: Uploading, Ready, Processing, Packaged, Failed | App, then flow | Yes | The flow starts only on Ready. For an approval request, Packaged means the approvers were emailed. The app counts "not finished within 30 minutes" from the item's Modified time (built in), so a retry starts the time again |
| FolderName | Folder name | Single line of text | App | | Packages only. Built by the app's naming rule. The flow removes unsafe characters again |
| PreviousFolderName | Replaces folder | Single line of text | App | | For resubmissions, the earlier folder name |
| SubmitterName | Submitted by | Single line of text | App | | Display name, frozen. The approver for the package of a request the approver bought |
| SubmitterEmail | Submitted by (account) | Single line of text | App | | The signed-in account's email, frozen (travel D-064). For a request the approver buys, the approval request's value is the employee who certified, and the app reads the certification from the newest approval request (P-041) |
| CertificationText | Certification | Multiple lines of plain text | App | | The sentence the employee ticked: at Submit for a request the employee buys; when sending to the approver for a request the approver buys (the approval request holds it, and the approver's package repeats it, P-041). Empty for the approval request of a request the employee buys |
| BusinessPurpose | Business purpose | Single line of text | App | | Frozen copy |
| Department, ProjectCode | Department, Project or grant code | Single line of text | App | | Frozen copy |
| PurchaseDates | Purchase dates | Single line of text | App | | "2026-10-12 to 2026-10-14" |
| TotalReimburse, TotalCompany, TotalRequest | Totals | Currency | App | | Frozen copy |
| ReceiptCount | Receipts | Number | App | | Receipt copies in the package |
| QuoteCount | Quotes | Number | App | | Quote copies in the package |
| RowsWithoutReceipt | Rows without a receipt | Number | App | | |
| BoughtBeforeApproval | Bought before approval | Yes/No | App | | Frozen copy of the flag |
| ApprovedBy, ApprovedOn | Approved by, Approved | Single line of text | App | | Packages only: the approver's name and time, frozen |
| EmailSubject | Email subject | Single line of text | App | | The email's subject, written by the app so all wording lives in the code |
| EmailSummary | Email summary | Multiple lines of plain text | App | | The email body as plain text. The flow escapes it before sending (travel D-067) |
| FolderLink | Folder link | Multiple lines of plain text | Flow | | Packages only |
| PackagedAt | Packaged | Date and time | Flow | | |
| ErrorMessage | Error | Multiple lines of plain text | Flow | | Set when packaging or sending fails |

Attachments: for a package, the receipt copies, quote copies and the CSV file, exactly as they will appear in the folder. An approval request has no attachments.

---

## Lifecycle rules

**When the approver buys it (the default, P-037):**

| Status | Employee can | Approver or administrator can |
|---|---|---|
| Draft | Edit; delete the request or any row; send to the approver (every vendor total goes, whatever the amount; the employee ticks the certification) | View |
| Awaiting approval | View only | Approve (confirming or changing categories; refused if the rows no longer match what was sent, P-019); return with a note; retry the approval email (only if it failed or is stuck, P-030) |
| Approved | View only. Approving the request means the approver buys it, so the rows are locked to the employee | The approver who approved it: change anything, add or remove rows, attach the receipts, Mark purchased (P-040). Any administrator: return it to the employee, which takes the approval back (refused while rows the approver added exist, P-042), view, confirm or change categories |
| Submitted (shown as Purchased) | View only | Mark processed; return it to the approver with a note (the status goes back to Approved, P-042); confirm or change categories; retry packaging |
| Returned | Edit; send to the approver again | View |
| Processed | View only | View |

**When the employee buys it:**

| Status | Employee can | Approver or administrator can |
|---|---|---|
| Draft | Edit; delete the request or any row; send for approval (if a vendor total is $500 or more) or submit (if not) | View |
| Awaiting approval | View only | Approve (confirming or changing categories; refused if the vendor totals no longer match what was sent, P-019); return with a note; retry the approval email (only if it failed or is stuck, P-030) |
| Approved | Edit; submit; send for approval again (if it changed beyond P-019) | View; confirm or change categories |
| Submitted | View only | Mark processed; return with a note; confirm or change categories; retry packaging |
| Returned | Edit; send for approval again or submit | View |
| Processed | View only | View |

A request can be deleted only while it is a Draft. Rows and files can still be removed while a request is Approved or Returned, because receipts and real prices arrive after approval; what the approver approved is kept in the approval record, and P-019 sends the request back for approval if a vendor total rises past it. Direct edits in SharePoint remain possible under travel D-002 and are recorded in version history.

---

## What each part of the system reads and writes

| Component | Purchase Requests | Purchase Request Lines | Purchase Submissions |
|---|---|---|---|
| App, as an employee | Own items: create, edit while editable, delete while Draft; status when sending for approval and submitting | Own items: create, edit, delete while editable | Own items: create (an approval request, or a package with its files), then set Ready |
| App, as an approver or administrator | All items: approve, return, process; approval fields | All items: read; change category. The approver of a request the approver buys: also create, change and delete rows and attach files (P-040) | All items: read; set back to Ready to retry. The approver of a request the approver buys: create the package (P-040) |
| Flow (Max's connection) | Not used | Not used | Read the triggering item and its attachments; update status, folder link, time and error |
