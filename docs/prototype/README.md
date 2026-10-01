# Purchase Requests prototype

**Status:** Current with the approver-buys build (2026-10-01, after Max's answers of that day). Not yet reviewed by Max. Nothing here runs in SharePoint yet.

These are the real app screens (the same React code that goes into SharePoint), running on synthetic sample data in a local preview. Packaging and emails are simulated. People, vendors and files are made up; every sample receipt, invoice and quote is stamped "synthetic sample for testing". The screenshots are taken with the browser's clock fixed at 2026-10-12, the day the sample data is set on, so they look the same whenever the script is run.

There are two ways a purchase goes, and the screenshots follow both:

- **The approver buys it** (the usual way, about 95% of purchases, and the default: "Who buys this?" starts on "The approver buys it", P-037). The employee says what to buy and sends it with the certification. Every such request goes to the approver, whatever the amount. The approver approves, buys, corrects what was bought, attaches the receipt and chooses Mark purchased.
- **The employee buys it** (the first build's path). A request with every vendor total under $500 is bought and submitted without approval. A vendor total of $500 or more goes to the approver first.

## The sample people and requests

| Person | Role in the preview |
|---|---|
| Jane Doe (`?user=jane`) | Employee |
| Sam Lee (`?user=sam`) | Employee |
| Max Wamsley (`?user=admin`) | Administrator and approver (the site Owners, P-020) |

| Request | Who | Who buys | Status | What it shows |
|---|---|---|---|---|
| PR-0041 | Jane | The approver | Draft | Lab supplies for the Phase 1 assay. Acme Lab Supply $640.00 with its quote attached, Northwind Office Supply $86.45. Each row has its item link. Ready to send to the approver |
| PR-0040 | Jane | The approver | Awaiting approval | Software license. Harbor Software $870.00 with a quote, Blue Fern Web Co. $129.00. The approver has been emailed |
| PR-0039 | Jane | The approver | Submitted (shown as Purchased) | Cell culture supplies. Max approved it and bought it, changed the rows, added a shipping row, and attached the receipts. The rows as sent are kept beside what was bought |
| PR-0038 | Jane | The approver | Approved | Sensor kit. Kestrel Instruments $1,150.00, quote attached. Max approved it and has not bought it yet, so it is in his To buy list |
| PR-0037 | Jane | The employee | Submitted | Website hosting and marketing. Blue Fern Web Co. $1,140.00 over two rows with one shared receipt. Bought before approval, then approved. The package was created |
| PR-0036 | Jane | The employee | Processed | Office supplies and postage |
| PR-0035 | Sam | The employee | Submitted | Office supplies for the new hire. The same Northwind receipt as PR-0036 (a possible duplicate between employees). The package failed |
| PR-0034 | Sam | The employee | Returned at processing | Training course. Row 2 has no receipt. The administrator's note asks for the invoice |
| PR-0033 | Sam | The approver | Returned at approval | Workbench. Redwood Fabrication $900.00 has no quote and no reason. The approver's note asks for one |
| PR-0032 | Sam | The employee | Awaiting approval | Conference booth materials. Ridgeline Displays $1,300.00 with a no-quote reason. The approval email failed |

The sample files are in `test/fixtures/receipts` (made by `node preview/tools/generate-sample-receipts.mjs`): quotes and invoices for Acme Lab Supply, Harbor Software and Kestrel Instruments, an invoice for Blue Fern Web Co. and one for Cobalt Biosupply, and receipts for Northwind Office Supply, QuickShip Postage and Summit Training Institute.

## The screenshots

All at 1440 pixels wide (a typical laptop) unless noted.

**Employee**

| File | What it shows |
|---|---|
| `01-my-requests.png` | Jane's home page: her requests with status badges and totals. PR-0039 shows as Purchased and PR-0038 as Approved |
| `02-new-request-details.png` | A new request, step 1. "Who buys this?" starts on "The approver buys it". The department is filled in from her last request; nothing else is. Nothing shows in red until she starts |
| `03-purchases-laptop.png` | PR-0041, step 2, a request the approver buys. The drop box takes quotes (a vendor total of $500 or more needs one), the grid has an Item link column and no Who paid column, and the Vendor totals table shows that both vendor totals go to the approver |
| `04-purchases-quote-slide-over.png` | Clicking a file on a laptop screen slides it in from the right. Here the Acme quote |
| `05-purchases-row-menu.png` | The row menu: attach a quote, remove a file, delete the row |
| `06-purchases-wide-screen.png` | 1920 wide: the files sit beside the grid |
| `07-purchases-receipt-suggestions.png` | A request the employee buys: three receipts dropped on it. The app read each one and filled in the date, vendor and amount, plus the category and who paid from last time, highlighted with a Confirm button under each row. The amber flag is the duplicate check |
| `08-review-with-problems.png` | Sam's PR-0033, step 3. "Before you send" lists a problem to fix (a $900 vendor total with no quote or reason). Send to the approver is disabled |
| `09-review-ready-to-send.png` | After he gave the reason: nothing is left to fix and Send to the approver is enabled |
| `10-send-dialog-bought-before-approval.png` | PR-0041 switched to "I will buy it myself", with a purchase dated before today: the dialog names the vendor total and says it will be flagged "Bought before approval". It can still be sent. No certification here (P-028) |
| `11-instructions.png` | The Instructions panel, "How to make a purchase request" |
| `12-returned-requests.png` | Sam's home page with one banner for each returned request. One says it was returned by the approver, the other by the administrator, each with its note and a Correct it button |

**The usual path, one request from start to finish** (the preview keeps the sample data between people, so the screenshots below follow PR-0041)

| File | What it shows |
|---|---|
| `13-send-for-approval-dialog.png` | Jane sends PR-0041 to the approver. The certification is ticked here, because the employee does not submit later (P-037). Nothing is flagged as bought before approval |
| `14-admin-approvals.png` | Max's Approvals page now lists PR-0041 with the requests already waiting |
| `34-admin-approved-to-buy.png` | Max approved it (and changed one category). The page says he approved it and buys it, and offers Open to buy or Return to the employee. The rows as Jane sent them are kept at the bottom |
| `15-approved-request.png` | Back as Jane: the green banner says who approved it and shows Max's note. She has nothing to do, and the rows are locked to her because the approver buys |
| `35-buying-purchases.png` | Max buying: he changed row 1 to the real amount, attached an invoice to each row, and added a shipping row that shares the first invoice. "As sent for approval" keeps what Jane asked for |
| `16-submit-dialog.png` | Max chooses Mark purchased. The dialog says Jane certified the request when she sent it, so he ticks nothing |
| `17-submitted.png` | After Mark purchased: shown as Purchased, with the package status |
| `18-admin-requests-to-process.png` | Max's Requests to process page lists PR-0041 |
| `19-admin-request-processed.png` | After Mark processed. The CSV names the QuickBooks account on each row (number and name) |

**The employee buys it**

| File | What it shows |
|---|---|
| `36-employee-submit-dialog.png` | Sam, whose request PR-0032 was approved, attaches his receipt and submits. He ticks the certification here; Submit stays disabled until he does |

**Administrator**

| File | What it shows |
|---|---|
| `20-admin-request-awaiting-approval.png` | PR-0040: the approver's view. Each category is a drop-down, because the employee only suggested it, and the QuickBooks account is shown. Each item link is a link, and each attached file name opens in a preview. Return with a note and Approve are in the header |
| `21-admin-approve-dialog.png` | The Approve dialog: approving means the approver buys it, confirms the categories shown and records each vendor total as approved. It counts the categories changed, and takes an optional note for the employee |
| `22-admin-return-dialog.png` | Returning a request at the approval step: the note is required, and the employee is asked to correct it and send it again |
| `23-admin-approval-email.png` | The approval email as the approvers receive it, as plain text. It says every vendor total needs approval |
| `24-admin-submission-email.png` | The submission email for PR-0037, with the approval, the "bought before approval" flag and the employee's certification |
| `25-admin-csv.png` | The CSV file's contents (31 columns, one row per purchase) |
| `26-admin-folder-contents.png` | The files that go in the request folder |
| `37-admin-request-purchased.png` | PR-0039, which Max bought: the rows as the employee sent them, then what was bought, with the buyer named |
| `38-admin-approvals-to-buy.png` | The Approvals page with the To buy list: the approved requests waiting to be bought, with "You" beside the ones the signed-in approver approved |
| `27-admin-needs-attention.png` | An approval email that was not sent, a package that was not created, and a possible duplicate between two employees |
| `28-admin-failed-package.png` | A failed package, with Retry packaging. The red banner says what to do first |
| `29-admin-all-requests.png` | Every employee's requests, with a filter for each status |
| `30-admin-setup-new-site.png` | A new site: the administrator sees only Set-up until the lists exist (travel D-063) |
| `31-admin-setup-done.png` | After "Create the lists": all three ready |
| `32-admin-flow-package.png` | Step 2: the test flow package downloaded (`PurchaseRequests_Flow_Test.zip`), with where the folders go and where the submission and approval emails go |
| `33-employee-site-not-set-up.png` | An employee on a site that is not set up yet |

## What the script checks

`npm run screenshots` also checks these in a real browser, and fails if any is wrong or if the browser reports an error:

- The usual path above: Jane sends PR-0041 and ticks the certification (Send stays disabled until she does; nothing is flagged as bought before approval), Max approves it with a changed category, Jane sees who approved it and is told she has nothing to do and cannot change the rows, Max opens it to buy, changes an amount, attaches receipts, adds a row that shares a receipt, and marks it purchased (the dialog says Jane certified it; he ticks nothing). The CSV names the QuickBooks account on each row. Max marks it processed.
- A request the approver buys: Jane is not asked for a receipt (it is the approver's to attach), and who buys cannot be changed once the request is approved.
- The other path: Max approves PR-0032, Sam is told to buy, attach and submit, is asked who paid, and cannot submit until the certification is ticked.
- The quote rule: a $640 vendor total with no quote shows the message and the "No quote: say why" box, and an item link or a reason is asked for when the approver buys. A quote dropped with the switch on Quotes is attached as a quote and is not read.
- The receipt reader fills in the Northwind, QuickShip and Summit files (date, vendor and amount) and marks them as suggested.
- The send dialog flags a purchase dated before today, and does not flag one dated after it, for a request the employee buys.
- Returned requests say who returned them; Needs attention lists both kinds of stuck submission and the duplicate; Set-up names the package and says where the approval emails go. Approvals lists the To buy requests. The administrator sees the rows as the employee sent them.
- An amount typed just after a row is added shows on screen and is saved, and the request total on screen matches what is saved. Typing 30 characters saves at most twice.
- A pasted row with a US date, a quoted cell with a line break and an amount is read; a pasted date that cannot be read is not used, a bad amount empties the amount, and one warning says what was skipped. A date with a year like 0026 is not saved.
- A dialog takes the focus and keeps Tab inside; Escape closes it (and the row menu) and the focus returns; a row of the Approvals list opens with Enter.
- The approver opens the Harbor quote of PR-0040 in the preview, and Tab reaches the PDF inside the preview.
- At 1024 and 375 wide, key pages fit their cards. The row menu button is inside the visible grid at 1280, 1366, 1600 and 1920 wide.
- Send waits for a slow save and records the amount typed just before; the row menu is switched off while a file is being attached; an Other description matches what is saved after the category changes and changes back.
- PR-0032 and PR-0035 offer Retry, and PR-0032's Retry and banner go once it is approved; a package stuck for 45 minutes (`&flow=off`) offers Retry and says so.

## What the review changed

Claude reviewed every screen before sending them. Changes made:

1. **The grid has fixed column widths**, so a long file name cannot widen the Files column and squeeze the vendor and description. The whole grid needs about 1090 pixels. The files panel sits beside it only when the page has room for the whole grid (about 1790 pixels wide with the full sidebar), and is a slide-over otherwise. On a screen too narrow for the grid it scrolls sideways, and the row menu column stays at the right edge so it can always be reached.
2. **The row menu is fixed to the window**, so the grid's own scrolling cannot cut it off. It opens upward near the bottom of the screen and follows its button when the page scrolls.
3. **The administrator's purchases table is compact** (nine columns since the item link was added: one Files column replaces Receipt and Quote, and Who paid sits under the amount) so it fits from 1024 wide up without scrolling.
4. **Header buttons sit on the right** when a long title pushes them to a second line, and request numbers never wrap.
5. **Receipt suggestions apply to receipts only.** A quote dropped on the box is attached as a quote and typed by hand.
6. **The "No quote" and "No receipt" boxes appear when they matter**: the quote reason on the first row of a vendor total of $500 or more while the request is waiting to be sent, the receipt reason once approval is done.
7. **Needs attention ignores a stuck submission whose request has moved on** (for example an approval email that failed, for a request approved in the app anyway).

## What the independent review changed (2026-10-01)

Four independent reviews (a requirements audit, a code review of the rules and data, a review of the flow package, and a browser test of the preview) found problems in this prototype. The ones that change what you see or do:

1. **The screen always shows what is saved.** Typing into a row a moment after adding a row, deleting one or attaching a file could leave the screen showing an old value while a different one was saved, so a total on the Review step could be wrong. Fixed, with a check in the screenshot script.
2. **Saving waits for a pause in typing.** It saved on every keystroke. It now saves half a second after the last one, and closing or reloading the page with something unsaved saves it first (the browser asks before leaving).
3. **Pasting from a spreadsheet** reads quoted cells and dates like 10/14/2026 or Oct 14, 2026, and says how many cells or rows it skipped and why, instead of dropping them silently. A bad amount empties the amount instead of keeping the old one. A date with a year like 0026 is not saved.
4. **Amounts** accept a comma only as a thousands separator, so "12,50" is no longer read as $1,250.00.
5. **Keyboard use.** Dialogs take the focus and keep Tab inside; Escape closes dialogs and the row menu and returns the focus; the rows of the administrator's lists open with Enter.
6. **The approver can read the quote.** Each attached file name on the administrator's request page opens a preview.
7. **Layout.** Tables scroll inside their cards instead of poking out, from 1024 wide down to a phone. The product is for laptop screens; smaller sizes are usable, not polished.

A second round (a browser test of the fixes, a review of the fixes, and a check of the records against the code) found and fixed these:

8. **The row menu and the Amount, Who paid and Approval columns were out of sight at common laptop widths** (1280, 1366 and 1600 to 1900 pixels). The grid is narrower, the menu column is pinned, and the files panel only sits beside the grid when there is room.
9. **Saves run in order**, and Send for approval and Submit wait for every save to finish (and stop if one failed), so a quick Send cannot record an amount typed a moment before.
10. **Changing a category from Other** clears the description on screen as well as in the record.
11. **Retry** appears on the request page whenever the app's rule allows it, including a submission that is stuck but not marked failed, and not on a request that has moved on.
12. **The send dialog names the vendors** that look already bought, and a flag kept from an earlier round has its own wording.
13. **Long words** break at the edge of their box instead of widening the page.

## Known limits of the preview

- **PDF files** show in the browser's own PDF viewer. The headless browser used for screenshots has no PDF viewer, so the screenshots of the slide-over use an image receipt. In SharePoint the app loads each PDF itself before showing it, so SharePoint's download settings cannot block the preview.
- **The employee sees every row**, including rows the approver added. On SharePoint the employee will not see rows the approver added (P-042), so the preview cannot show that effect.
- **Packaging and email** are simulated: a submission becomes "Packaged" after about three seconds and an approval email after about a second and a half.
- **Set-up** creates the lists instantly in the preview, and the flow package it downloads uses made-up site addresses and IDs.
- **Files you attach in the preview** are held in the browser's memory. They are not kept when you switch between people, so the preview of a file attached before a switch can no longer be shown.
- The preview can show a site before set-up: add `&setup=new` to the address. Add `&reader=off` to turn receipt suggestions off, `&flow=off` to keep a submission waiting for the flow (so a stuck one can be shown), and `&reset=1` to start again from the sample data. Do not put `reset=1` in an address you reload: it wipes the data each time.

## Running it yourself (optional)

From the `app` folder: `npm install`, then `npm run preview`, then open `http://127.0.0.1:5173/?user=jane` (or `user=sam`, or `user=admin`). A bar at the bottom switches between the sample people; the sample data is kept in the browser tab's session storage, so a request Jane sends is waiting for Max, and "Reset sample data" starts again. `npm run screenshots` recreates these images while the preview is running.
