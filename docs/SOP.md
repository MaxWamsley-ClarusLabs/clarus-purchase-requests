# Purchase Requests: standard operating procedure

**Status:** Draft, started 2026-09-30 in the overnight build. It describes the app as designed and built so far. The app is not installed anywhere yet, so nothing here is in use. This file is updated at every stage and proofread in full at Stage 12 (see `docs/STRATEGY.md` section 14).

**Owner:** Max Wamsley (administrator and approver).

**Scope:** non-travel purchase requests only. Travel goes to the Travel app. This SOP does not change `Clarus_Accounting_SOP.md`, which governs processing in QuickBooks, and it does not replace a purchasing policy: Max will write a new one with Claude after the app is complete (strategy, last stage).

---

## Part A. Employees

This part is the same text as the Instructions panel in the app.

<!-- Part A starts: generated from app/src/content/instructions.ts by "npm run sop". Edit the app text, not this block. -->

### What goes in a purchase request

Purchases that are not travel: materials, supplies and equipment, software, website and marketing costs, office supplies, training, shipping and postage, and insurance. One request covers one business purpose and can hold several purchases.

Travel costs (airfare, lodging, meals, ground transportation, registration and travel fees) do not belong here. Use the Travel app for those.

This app replaces the Word purchase request form and posting it in the Purchasing Receipt Team on Teams. The app records the request, the approval and the receipts, so you do not post anything in Teams.

### Starting a request

- Click New request. On Request details, enter your department and the business purpose in one line, for example "Lab supplies for the Phase 1 assay". The business purpose is also the name of the request.
- The project or grant code is optional. Type it or click the quick pick ("NSF SBIR Phase 1 (Award # 2528301)"). Nothing is filled in for you.
- Everything saves automatically. You can leave and come back.

### Adding purchases

- On the Purchases step, add one row for each purchase: date, vendor, what was bought and why, category, amount and who paid. Press Enter to move down a column. Ctrl+D copies the value from the row above.
- You can paste several rows from a spreadsheet. Put its columns in the order of the grid (date, vendor, what was bought and why, category, amount, who paid), add enough rows first, click the cell where the first value goes, and paste. Write dates like 2026-10-14, 10/14/2026 or Oct 14, 2026, categories and who paid as they are named in the lists, and amounts like 45.10. A value the app cannot read is not used, and a message says how many there were and why.
- Have the files? Drop receipts, invoices or quotes into the box at once (PDF, JPG, PNG or HEIC, up to 15 MB each). Each file becomes a row. The switch above the box says whether the files are receipts or invoices, or quotes.
- The app reads each receipt or invoice and fills in the date, amount and vendor it finds. For a vendor you have used before, typed or read, it also fills in the category and who paid last time. Values taken from the receipt, and a "Who paid" changed this way, are highlighted: check each one against the receipt, correct anything wrong, then click Confirm on the row. A row with highlighted values cannot be sent or submitted until you confirm it.
- The app only fills in empty boxes: anything you typed stays as you typed it. Quotes, unclear photos and HEIC files are not read; type those rows yourself. Receipts are read on your own computer; nothing is sent anywhere else to read them.
- One receipt for several purchases (for example one invoice for two items)? Add a row for each purchase, then use the row menu (the three dots) and choose "Same receipt as row". A row that holds its own receipt file cannot also use another row's.
- Another file for a row, such as a quote or a second page? Use the row menu and choose "Attach a receipt or invoice" or "Attach a quote".

### Approval and quotes

- Approval is worked out by vendor within one request. If the purchases from one vendor add up to $500 or more, you need the approver's approval before you buy. Splitting a purchase across rows does not avoid it. The Vendor totals table on the Purchases step shows each vendor's total and what it needs.
- For a vendor total of $500 or more, attach a quote (drop it as a quote, or use the row menu), or say why there is none in the "No quote: say why" box on the vendor's first row.
- When the request is ready, go to Review and submit and choose Send for approval. The request is locked and the approver (the site Owners) is emailed. Its status is Awaiting approval.
- If the approver returns the request, it shows as Returned with their note. Correct it and send it for approval again.
- Once it is approved, you can buy. Then attach your receipts and invoices, and submit (see Submitting).
- If a vendor total later rises more than 10% above the amount that was approved, or another vendor reaches $500, send the request for approval again. A small rise (for example tax or shipping) and any lower amount do not need approval again.
- If every vendor total is under $500, no approval is needed. You still submit the request with your receipts.

### Bought something before approval?

- If a purchase of $500 or more has already been made, you can still send the request for approval. The app flags it as "Bought before approval" when a row is dated before today or already has a receipt or invoice attached.
- The approver and the administrator both see the flag. The approver still has to approve the request, and may return it.
- Ask for approval before you buy whenever you can.

### Categories

You suggest a category for each row. The approver, when approving, or the administrator can confirm or change it. Choose Other only when nothing fits, and describe the category in the box that appears.

- R&D Materials & Supplies / Equipment: Materials, supplies and equipment for research and development work.
- Advertising/Marketing/Website: Advertising, marketing materials, and website or domain costs.
- Computer, H/W & S/W Supplies: Computer hardware, software and related supplies.
- Office Supplies: Everyday office supplies.
- Training and Education: Courses, training and educational materials.
- Shipping/Postage: Shipping and postage.
- Business Insurance: Business insurance premiums.
- Other: Anything that fits none of the above. Describe it.

### Who paid

- Company: Paid by Clarus (company card or invoice). Not reimbursed to you.
- Employee: You paid, so Clarus reimburses you.

### No receipt?

Every row needs a receipt or invoice before you submit, or a reason there is none, for example "Receipt lost". Type the reason in the "No receipt: say why" box on the row. A quote is not a receipt. Use "Add purchase without a file" to add a row you will fill in by hand.

### Submitting

- On Review and submit, fix anything marked in red, and confirm any rows the app filled in. Amber items are warnings: check them, but you can still go on.
- To submit, tick the certification: "I certify that the listed purchases are for official Clarus Labs business purposes, are not personal expenses, have not been reimbursed elsewhere, and that the information provided is accurate to the best of my knowledge." It is recorded with your account; no signature is needed.
- After you submit, the request is locked. The administrator is emailed and a folder with your receipts, quotes and a spreadsheet of the purchases is created for processing.
- If the administrator returns the request, you will see their note. Correct it and submit again.

### What this app does not cover

- Travel: use the Travel app.
- Foreign currency: enter the dollar amount from your card or bank statement, and note the foreign amount in "What was bought and why".

<!-- Part A ends -->

---

## Part B. Approver and administrator

Both roles are held today by the site Owners (people with SharePoint's "Manage web site" permission); in practice, Max. Steps marked "(checkpoint)" are written or confirmed when the first version is installed on the test site, so they name the real screens.

### B1. When a request is sent for approval

1. You receive an email "Purchase approval needed: <name>, <business purpose> (PR-0042)". It lists the requester, department, business purpose, project or grant code, each vendor total that needs approval with its quote status, any **Bought before approval** flag, and a link. It arrives a few minutes after the employee sends the request.
2. In the app, the request is under **Approvals** (the sidebar shows how many are waiting).

### B2. Approving or returning a request

1. In **Approvals**, open the request. Check the vendor totals, the lines, and the attached quotes or no-quote reasons. Click a file name on the Purchases tab to open the quote or receipt.
2. Confirm or change each category in the grid. The employee only suggested them.
3. Choose **Approve**. Approving confirms the categories shown and records each vendor total as approved at its current amount. You can add a note.
4. Or choose **Return with a note** and say what needs correcting. The employee sees the note and sends the request again.
5. If the request is flagged **Bought before approval**, the purchase was already made. Approving it is your decision; the flag stays on the request and is passed to the administrator's email and the CSV.
6. You may approve your own request. It is recorded as self-approved.
7. If a vendor total later rises more than 10% above the amount you approved, or a new vendor total of $500 or more appears, the employee has to send the request for approval again (strategy section 4).
8. You approve what was sent. If the request was changed after it was sent (for example edited directly in SharePoint), Approve is refused with "This request was changed after it was sent for approval...". Return it with a note instead; the employee corrects it and sends it again.
9. After approval the employee can still change the business purpose and the project or grant code, and remove a quote, without a new approval (a known gap, `docs/QUESTIONS_FOR_MAX.md` question 22). The submission email shows the purpose and code as submitted; compare them with what you approved.

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

1. In the app, open the request, choose **Return with a note**, write what needs correcting, and choose **Return request**. The employee sees the note.
2. Delete that request's folder from `Purchases_To_Process`. The corrected request arrives as a new folder ending in `_R2`.

### B7. Needs attention and failed packages (checkpoint)

- **Needs attention** in the app lists submissions whose folder was not created within 30 minutes, approval emails that were not sent within 30 minutes, and anything that failed. It also lists possible duplicates between two employees' requests, which only you can see.
- A failure also sends you an email. Open the request (from Needs attention) and choose **Retry packaging** (or **Retry approval email** for an approval). Retry works only on a submission that failed or has not finished within 30 minutes, while its request is still waiting for approval (an approval email) or submitted (a package). If an approval email had been sent before the failure, the approvers may get it twice.
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

To be completed from the test-site runs at the checkpoint. These messages are written from the code and are confirmed at the checkpoint.

| What you see | What it means | What to do |
|---|---|---|
| "This request was changed after it was sent for approval, so it cannot be approved as it stands." (approver) | The vendor totals no longer match what was sent | Return the request with a note; the employee sends it again |
| "Only an approval email or a package that failed, or that has not finished after 30 minutes, can be tried again." (administrator) | Retry was chosen too early | Wait 30 minutes, then check the flow is on (B7) |
| "The request has moved on since this was sent, so it cannot be tried again." (administrator) | The request was approved, returned or processed in the meantime | Nothing to retry |
| "This request needs approval first." (employee, at Submit) | A vendor total is over what was approved | Send the request for approval again |
| "Row N has no receipt of its own to share." (employee) | The row points at a row that has no receipt | Choose a row that has one, or attach a receipt |
| "This row has a receipt of its own." (employee) | A row cannot hold its own receipt and also use another row's | Remove its own receipt first |

---

## Revision history

| Date | Stage | Change |
|---|---|---|
| 2026-09-30 | 1 | Started. Part B drafted from decisions P-001 to P-031; Part A is generated from the in-app Instructions at Stage 7 |
| 2026-10-01 | 5 to 9 | Part A generated from the Instructions (Stage 5). Part B brought up to date with the built screens and the review fixes (opening quotes, approving what was sent, Retry rules); Part C started from the app's own messages |
