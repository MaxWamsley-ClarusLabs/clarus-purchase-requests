# Purchase Requests: standard operating procedure

**Status:** Draft, started 2026-09-30 in the overnight build. It describes the app as designed and built so far. The app is not installed anywhere yet, so nothing here is in use. This file is updated at every stage and proofread in full at Stage 12 (see `docs/STRATEGY.md` section 14).

**Owner:** Max Wamsley (administrator and approver).

**Scope:** non-travel purchase requests only. Travel goes to the Travel app. This SOP does not change `Clarus_Accounting_SOP.md`, which governs processing in QuickBooks, and it does not replace a purchasing policy: Max will write a new one with Claude after the app is complete (strategy, last stage).

---

## Part A. Employees

This part is the same text as the Instructions panel in the app.

<!-- Part A starts: generated from app/src/content/instructions.ts by "npm run sop". Edit the app text, not this block. -->

### What goes in a travel report

All travel costs of one trip, including those paid before or after it: airfare, lodging, ground transportation, fuel, parking and tolls, meals while travelling, event registration, and baggage and travel fees.

Materials and supplies do not belong here, even if you bought them for the trip (printing, posters, store purchases, equipment). Use the Purchase Request App for those.

### Starting a report

- Click New report and fill in the trip details: trip name, destination, dates, business purpose and what the trip was for.
- Not sure what the trip was for? Choose "Not sure". The administrator will decide.
- Everything saves automatically. You can leave and come back.

### Adding receipts and expenses

- On the Expenses step, drop all your receipts into the box at once (PDF, JPG, PNG or HEIC, up to 15 MB each). Each receipt becomes a row.
- The app reads each receipt and fills in the date, amount and vendor it finds. For a vendor you have used before, typed or read, it also fills in the category and how you paid last time. Values taken from the receipt, and a "Paid with" changed this way, are highlighted: check each one against the receipt, correct anything wrong, then click Confirm on the row. A row with highlighted values cannot be submitted until you confirm it.
- The app only fills in empty boxes: anything you typed stays as you typed it. Unclear photos and HEIC files are not read; type those rows yourself. Receipts are read on your own computer; nothing is sent anywhere else to read them.
- Fill in or check each row: date, vendor, category, amount and how it was paid. Press Enter to move down a column. Ctrl+D copies the value from the row above.
- One receipt for several expenses (for example a hotel bill with room and restaurant charges)? Add a row for each expense, then use the row menu (the three dots) and choose "Same receipt as row".
- Two files for one expense (for example an itemized receipt and the card slip)? Use the row menu and choose "Add another file".
- Drove your own car? On Trip details, turn on "I drove my own car". Then on Expenses, add each drive: date, from, to and miles (a round trip is one drive with the total miles). The app works out the amount at the GSA rate. No receipt is needed.

### Categories

- Airfare: Tickets, airline baggage and seat fees.
- Lodging: Hotels, short-term rentals.
- Meals: Meals while travelling, alone or with other Clarus staff.
- Business meal with guests: Meals with non-Clarus guests (customers, partners).
- Transportation: Taxi, rideshare, train, bus, rental car, fuel, parking, tolls.
- Registration and conferences: Event and conference registration.
- Other travel: Travel costs that fit none of the above.

### How it was paid

- Personal card or cash (reimburse me): you will be reimbursed.
- Company card: not reimbursed to you.
- Paid directly by Clarus: not reimbursed to you.
- If the administrator booked something for you (for example a flight), add it as "Paid directly by Clarus" and attach the confirmation.

### Shared costs

The person whose card paid reports the expense, even if it covered other people too.

### No receipt?

Add the expense with "Add expense without receipt" and say why there is no receipt. The administrator will see the reason.

### Travel policy reminders

- Meals: the limit is $68.00 a day, the GSA standard per diem for meals and incidentals, the same every day of the trip. The app flags a day that is over it, or on track to be: for example one $30 meal, which at that rate would make about $90 for three meals. A flag does not stop you submitting; the administrator sees it.
- Receipts: itemized receipts are needed for lodging, airfare, rental cars, other ground transportation and meals, and for any other single expense over $25.
- Not reimbursed: alcoholic drinks, entertainment, personal items (such as toiletries or souvenirs), and traffic fines or parking tickets.
- Airfare is economy or coach. Rental cars are compact or intermediate size, unless there is a documented reason.
- Mileage in your own car is paid at the GSA rate (now 76 cents a mile). Driving between home and your usual workplace is commuting and is not paid.

### What this app does not cover yet

- Per diem allowances: enter what meals actually cost, with receipts.
- Foreign currency: enter the dollar amount from your card or bank statement, and note the foreign amount in the description.

### Submitting

- Submit within 30 days after the trip ends, as the travel policy asks. A later report can still be submitted; it is marked as late for the administrator.
- On Review and submit, fix anything marked in red, and confirm any rows the app filled in. Amber items are warnings: check them, but you can still submit.
- To submit, tick the certification that the expenses were for official business, follow the travel policy and are accurate. It is recorded with your account; no signature is needed.
- After you submit, the report is locked. The administrator is emailed and a folder with your receipts is created for processing.
- If the administrator returns the report, you will see their note. Correct it and submit again.

<!-- Part A ends -->

---

## Part B. Approver and administrator

Both roles are held today by the site Owners (people with SharePoint's "Manage web site" permission); in practice, Max. Steps marked "(checkpoint)" are written or confirmed when the first version is installed on the test site, so they name the real screens.

### B1. When a request is sent for approval

1. You receive an email "Purchase approval needed: <name>, <business purpose> (PR-0042)". It lists the requester, department, business purpose, project or grant code, each vendor total that needs approval with its quote status, any **Bought before approval** flag, and a link. It arrives a few minutes after the employee sends the request.
2. In the app, the request is under **Approvals** (the sidebar shows how many are waiting).

### B2. Approving or returning a request

1. In **Approvals**, open the request. Check the vendor totals, the lines, and the attached quotes or no-quote reasons.
2. Confirm or change each category in the grid. The employee only suggested them.
3. Choose **Approve**. Approving confirms the categories shown and records each vendor total as approved at its current amount. You can add a note.
4. Or choose **Return with a note** and say what needs correcting. The employee sees the note and sends the request again.
5. If the request is flagged **Bought before approval**, the purchase was already made. Approving it is your decision; the flag stays on the request and is passed to the administrator's email and the CSV.
6. You may approve your own request. It is recorded as self-approved.
7. If a vendor total later rises more than 10% above the amount you approved, or a new vendor total of $500 or more appears, the employee has to send the request for approval again (strategy section 4).

### B3. When a request is submitted

1. You receive an email: "Purchase request submitted: <name>, <business purpose> (PR-0042)", or "resubmitted" with the submission number. It lists the submitter and their account, the department, business purpose and project or grant code, the purchase dates, **To reimburse**, **Paid by Clarus** and **Request total**, the number of receipts and quotes, rows without a receipt, any warnings, the approval (who, when, and any note), any **Bought before approval** flag, and the employee's certification, with links to the folder, `Purchases_To_Process` and the request in the app. It arrives a few minutes after the employee submits.
2. The request folder is in `Accounting/Purchases/Purchases_To_Process/`, named `YYYY-MM-DD_Employee-Name_Business-Purpose_PR-0042` (earliest purchase date). A resubmission ends in `_R2`, `_R3`.
3. The folder holds a copy of each receipt (`R01_<original name>`, a second file on the same row `R01-2_...`), a copy of each quote (`Q01_<original name>`), and one CSV file, `PR-0042_Purchases.csv`.
4. In the app, the request is under **Requests to process**.

The app and the flow never change, move or delete anything else in the Accounting folder. They only create new folders and files inside `Purchases_To_Process`.

### B4. Processing

1. Process the folder with the receipt skill and enter the purchases in QuickBooks as set out in `Clarus_Accounting_SOP.md`. The CSV gives a suggested QuickBooks account for each row. **The suggestions are Unverified, to confirm with Max** (P-025); you decide the account.
2. Rows paid by the **Employee** are the ones to reimburse. The "To reimburse" total in the email and the app is their sum.
3. You can confirm or change a row's category in the app. The CSV already in the folder keeps the category as it was submitted.

### B5. Filing and marking processed

1. Move the request folder from `Purchases_To_Process` into `Accounting/Purchases/<year>/`, using the year of the earliest purchase date. Create the year folder the first time it is needed, for example in January.
2. In the app, open the request and choose **Mark processed**. This only changes the request's status; no email is sent.

### B6. Returning a request for correction

1. In the app, open the request, choose **Return**, and write what needs correcting. The employee sees the note.
2. Delete that request's folder from `Purchases_To_Process`. The corrected request arrives as a new folder ending in `_R2`.

### B7. Needs attention and failed packages (checkpoint)

- **Needs attention** in the app lists submissions whose folder was not created within 30 minutes, approval emails that were not sent within 30 minutes, and anything that failed. It also lists possible duplicates between two employees' requests, which only you can see.
- A failure also sends you an email. Open the request and choose **Retry packaging** (or **Retry approval email** for an approval).
- If it keeps failing, the flow is usually off or its connection needs signing in again. Steps for checking the flow are added at the checkpoint.

### B8. Adding an employee or an approver (checkpoint)

- Employee: add them as a Member of the Forms and Apps site.
- Approver or administrator: add them as an Owner of the site, which gives them the **Approvals** and administrator pages. The approval email goes to the Owners' addresses as they were when the flow package was made, so after adding an Owner, make a new flow package from Set-up and import it (B9).

### B9. Setting up the site (checkpoint)

Done once per site: the test site first, the production site at the pilot. Exact steps are in `docs/CHECKPOINT.md`.

1. Open the Purchase Requests page on the site. Until its lists exist, you see only Set-up.
2. Under "1. Lists on this site", choose Create the lists. All three should show Ready. If a list shows "Permissions not set" or "Address in use", follow the text shown on the page.
3. Under "2. Flow package", choose Test (test site) or Live (production), then Download flow package.
4. In Power Automate, open My flows, then Import, then Import Package (Legacy). Upload the file, choose your own SharePoint and Office 365 Outlook connections, import, then open the flow and turn it on.
5. After installing a new version of the app, open Set-up again and choose Check again; update the lists if asked.

---

## Part C. Troubleshooting and support

Written from the test-site runs at the checkpoint.

---

## Revision history

| Date | Stage | Change |
|---|---|---|
| 2026-09-30 | 1 | Started. Part B drafted from decisions P-001 to P-031; Part A is generated from the in-app Instructions at Stage 7 |
