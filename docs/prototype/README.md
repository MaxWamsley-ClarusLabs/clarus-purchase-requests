# Purchase Requests prototype

**Status:** Current with the Stage 5 screens (built overnight, 2026-10-01). Not yet reviewed by Max. Nothing here runs in SharePoint yet.

These are the real app screens (the same React code that goes into SharePoint), running on synthetic sample data in a local preview. Packaging and emails are simulated. People, vendors and files are made up; every sample receipt, invoice and quote is stamped "synthetic sample for testing". The screenshots are taken with the browser's clock fixed at 2026-10-12, the day the sample data is set on, so they look the same whenever the script is run.

## The sample people and requests

| Person | Role in the preview |
|---|---|
| Jane Doe (`?user=jane`) | Employee |
| Sam Lee (`?user=sam`) | Employee |
| Max Wamsley (`?user=admin`) | Administrator and approver (the site Owners, P-020) |

| Request | Who | Status | What it shows |
|---|---|---|---|
| PR-0041 | Jane | Draft | Lab supplies for the Phase 1 assay. Acme Lab Supply $640.00 with its quote attached (needs approval), Northwind Office Supply $86.45 (needs none). Ready to send for approval |
| PR-0040 | Jane | Awaiting approval | Software licence. Harbor Software $870.00 with a quote, Blue Fern Web Co. $129.00. The approver has been emailed |
| PR-0038 | Jane | Approved | Sensor kit. Kestrel Instruments $1,150.00, quote attached, approved with a note. The receipt is still to come |
| PR-0037 | Jane | Submitted | Website hosting and marketing. Blue Fern Web Co. $1,140.00 over two rows with one shared receipt. Bought before approval, then approved. The package was created |
| PR-0036 | Jane | Processed | Office supplies and postage |
| PR-0035 | Sam | Submitted | Office supplies for the new hire. The same Northwind receipt as PR-0036 (a possible duplicate between employees). The package failed |
| PR-0034 | Sam | Returned at processing | Training course. Row 2 has no receipt. The administrator's note asks for the invoice |
| PR-0033 | Sam | Returned at approval | Workbench. Redwood Fabrication $900.00 has no quote and no reason. The approver's note asks for one |
| PR-0032 | Sam | Awaiting approval | Conference booth materials. Ridgeline Displays $1,300.00 with a no-quote reason. The approval email failed |

The sample files are in `test/fixtures/receipts` (made by `node preview/tools/generate-sample-receipts.mjs`): quotes and invoices for Acme Lab Supply, Harbor Software and Kestrel Instruments, an invoice for Blue Fern Web Co., and receipts for Northwind Office Supply, QuickShip Postage and Summit Training Institute.

## The screenshots

All at 1440 pixels wide (a typical laptop) unless noted.

**Employee**

| File | What it shows |
|---|---|
| `01-my-requests.png` | Jane's home page: her requests with status badges and totals. A green banner says PR-0038 is approved, with an Open button. PR-0037 carries the amber "Bought before approval" tag |
| `02-new-request-details.png` | A new request, step 1. The department is filled in from her last request; nothing else is. "How approval works" explains the $500 rule. Nothing shows in red until she starts |
| `03-purchases-laptop.png` | PR-0041, step 2. The drop box with its Receipts or invoices / Quotes switch and the quote reminder, the grid, and the Vendor totals table: Acme needs approval and has a quote attached, Northwind needs none |
| `04-purchases-receipt-slide-over.png` | Clicking a file on a laptop screen slides it in from the right. Here a receipt just attached from the row menu |
| `05-purchases-row-menu.png` | The row menu: attach a receipt or invoice, attach a quote, "same receipt as row", remove a file, delete the row |
| `06-purchases-wide-screen.png` | 1920 wide: the files sit beside the grid |
| `07-purchases-receipt-suggestions.png` | Three receipts dropped on a new request. The app read each one and filled in the date, vendor and amount, plus the category and who paid from last time, highlighted with a Confirm button under each row. The amber flag is the duplicate check: Jane already has the Northwind receipt in PR-0036 |
| `08-review-with-problems.png` | Sam's PR-0033, step 3. "Before you send" lists a problem to fix (a $900 vendor total with no quote or reason) and a warning (the purchase looks already bought). The Approval card shows what needs approval. Send for approval is disabled |
| `09-review-ready-to-send.png` | After he gave the reason: only the warning is left, and Send for approval is enabled |
| `10-send-dialog-bought-before-approval.png` | The Send for approval dialog for that request: the vendor total being sent, and the amber note that it will be flagged "Bought before approval". It can still be sent. No certification here (P-028) |
| `11-instructions.png` | The Instructions panel, "How to make a purchase request" |
| `12-returned-requests.png` | Sam's home page with one banner for each returned request. One says it was returned by the approver, the other by the administrator, each with its note and a Correct it button |

**The approval path, one request from start to finish** (the preview keeps the sample data between people, so the screenshots below follow PR-0041)

| File | What it shows |
|---|---|
| `13-send-for-approval-dialog.png` | Jane sends PR-0041 for approval. Nothing in it looks already bought |
| `14-admin-approvals.png` | Max's Approvals page now lists PR-0041 with the two requests already waiting. The sidebar count says 3 |
| `15-approved-request.png` | Back as Jane: the green banner says who approved it and when, with Max's note. Her request is open again, because receipts and real prices arrive after the approval. Each row now asks for a receipt |
| `16-submit-dialog.png` | After attaching her receipts: the Submit dialog with the certification tick box (P-010). Submit stays disabled until it is ticked |
| `17-submitted.png` | After submitting: locked, with the package status and the approval still shown |
| `18-admin-requests-to-process.png` | Max's Requests to process page lists PR-0041 |
| `19-admin-request-processed.png` | After Mark processed. The category Max changed while approving is shown as confirmed by him |

**Administrator**

| File | What it shows |
|---|---|
| `20-admin-request-awaiting-approval.png` | PR-0040: the approver's view. Each category is a drop-down, because the employee only suggested it. Return with a note and Approve are in the header |
| `21-admin-approve-dialog.png` | The Approve dialog: approving confirms the categories shown and records each vendor total as approved. It counts the categories changed, and takes an optional note for the employee |
| `22-admin-return-dialog.png` | Returning a request at the approval step: the note is required, and the employee is asked to correct it and send it again |
| `23-admin-approval-email.png` | The approval email as the approvers receive it, as plain text |
| `24-admin-submission-email.png` | The submission email for PR-0037, with the approval, the "bought before approval" flag and the employee's certification |
| `25-admin-csv.png` | The CSV file's contents (28 columns, one row per purchase) |
| `26-admin-folder-contents.png` | The files that go in the request folder |
| `27-admin-needs-attention.png` | An approval email that was not sent, a package that was not created, and a possible duplicate between two employees |
| `28-admin-failed-package.png` | A failed package, with Retry packaging. The red banner says what to do first |
| `29-admin-all-requests.png` | Every employee's requests, with a filter for each status |
| `30-admin-setup-new-site.png` | A new site: the administrator sees only Set-up until the lists exist (travel D-063) |
| `31-admin-setup-done.png` | After "Create the lists": all three ready |
| `32-admin-flow-package.png` | Step 2: the test flow package downloaded (`PurchaseRequests_Flow_Test.zip`), with where the folders go and where the submission and approval emails go |
| `33-employee-site-not-set-up.png` | An employee on a site that is not set up yet |

## What the script checks

`npm run screenshots` also checks these in a real browser, and fails if any is wrong or if the browser reports an error:

- The first row's Who paid starts as Company, a new row copies the row above, and the category comes from a vendor used before.
- The quote rule: a $640 vendor total with no quote shows the message and the "No quote: say why" box, and the "No receipt" box waits until approval is done. A quote dropped with the switch on Quotes is attached as a quote and is not read.
- The receipt reader fills in the Northwind, QuickShip and Summit files (date, vendor and amount) and marks them as suggested.
- The send dialog flags a purchase dated before today, and does not flag one dated after it.
- The whole approval path above: Jane sends PR-0041 (Awaiting approval), Max approves it with a changed category (Approved), Jane attaches receipts and submits (Submit is disabled until the certification is ticked; then Submitted), Max marks it processed (Processed).
- Returned requests say who returned them; Needs attention lists both kinds of stuck submission and the duplicate; Set-up names the package and says where the approval emails go.

## What the review changed

Claude reviewed every screen before sending them. Changes made:

1. **The grid has fixed column widths**, so a long file name cannot widen the Files column and squeeze the vendor and description. On a screen too narrow for its columns the grid scrolls sideways.
2. **The row menu is fixed to the window**, so the grid's own scrolling cannot cut it off. It opens upward near the bottom of the screen.
3. **The administrator's purchases table is compact** (a flag icon for "bought before approval" instead of a tag) so all ten columns fit at 1440 without scrolling.
4. **Header buttons sit on the right** when a long title pushes them to a second line, and request numbers never wrap.
5. **Receipt suggestions apply to receipts only.** A quote dropped on the box is attached as a quote and typed by hand.
6. **The "No quote" and "No receipt" boxes appear when they matter**: the quote reason on the first row of a vendor total of $500 or more while the request is waiting to be sent, the receipt reason once approval is done.
7. **Needs attention ignores a stuck submission whose request has moved on** (for example an approval email that failed, for a request approved in the app anyway).

## Known limits of the preview

- **PDF files** show in the browser's own PDF viewer. The headless browser used for screenshots has no PDF viewer, so the screenshots of the slide-over use an image receipt. In SharePoint the app loads each PDF itself before showing it, so SharePoint's download settings cannot block the preview.
- **Packaging and email** are simulated: a submission becomes "Packaged" after about three seconds and an approval email after about a second and a half.
- **Set-up** creates the lists instantly in the preview, and the flow package it downloads uses made-up site addresses and IDs.
- **Files you attach in the preview** are held in the browser's memory. They are not kept when you switch between people, so the preview of a file attached before a switch can no longer be shown.
- The preview can show a site before set-up: add `&setup=new` to the address. Add `&reader=off` to turn receipt suggestions off, and `&reset=1` to start again from the sample data.

## Running it yourself (optional)

From the `app` folder: `npm install`, then `npm run preview`, then open `http://127.0.0.1:5173/?user=jane` (or `user=sam`, or `user=admin`). A bar at the bottom switches between the sample people; the sample data is kept in the browser tab's session storage, so a request Jane sends is waiting for Max, and "Reset sample data" starts again. `npm run screenshots` recreates these images while the preview is running.
