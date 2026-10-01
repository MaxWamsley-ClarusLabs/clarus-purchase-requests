# Purchase Requests: standard operating procedure

**Status:** Draft, started 2026-09-30 in the overnight build. It describes the app as designed and built so far. The app is not installed anywhere yet, so nothing here is in use. This file is updated at every stage and proofread in full at Stage 12 (see `docs/STRATEGY.md` section 14).

**Owner:** Max Wamsley (administrator and approver).

**Scope:** non-travel purchase requests only. Travel goes to the Travel app. This SOP does not change `Clarus_Accounting_SOP.md`, which governs processing in QuickBooks, and it does not replace a purchasing policy: Max will write a new one with Claude after the app is complete (strategy, last stage).

## Rules confirmed by Max

These are decided, not provisional. The new purchasing policy (the last stage) must keep them.

- **Quote threshold: $500.** A vendor total of $500 or more within one request needs a quote or a written no-quote reason, however it is bought (confirmed 2026-10-01).
- **Who buys.** About 95% of purchases are bought by the person who approves the request, so that is the default. The employee says what to buy; every such request goes to the approver, whatever the amount; the approver approves, buys, corrects the actual amounts, attaches the receipt and chooses Mark purchased. The employee ticks the certification when sending the request. The employee can instead choose to buy it themselves (2026-10-01).
- **Approval threshold: $500, for a request the employee buys.** A vendor total of $500 or more within one request needs the approver's approval before the purchase. Under $500 needs no approval, but the request is still submitted with its receipts (confirmed 2026-10-01).
- **Item link.** Each row has the web page of the item, or says why there is none. The approver needs it to buy (2026-10-01).
- **Categories are the QuickBooks accounts.** Thirteen categories, each a QuickBooks account number and name, supplied by Max on 2026-10-01 from the May 1, 2026 account list. Equipment and Other: the administrator decides the account.
- **The old form's wording is retired.** The attached F2 form's approval and quote wording is not used, and the thresholds above replace it. It must not appear in this SOP or the purchasing policy (2026-10-01).
- **Who approves.** The site Owners approve. An Owner may approve their own request; it is recorded as self-approved (2026-10-01).
- **After approval, when the employee buys.** A vendor total that rises more than 10% above the approved amount, or a new vendor total of $500 or more, needs approval again (2026-10-01).
- **A purchase the employee already made.** It can still be sent for approval first and submitted afterwards, flagged "Bought before approval". Max left the detail to Claude (2026-10-01).
- **Still open (policy stage):** where Equipment is capitalized rather than expensed, and whether the account list needs a class. Both wait for the new purchasing policy.

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
- Choose who buys it. The approver buys it is the usual choice and is chosen for you: you say what to buy, and the approver (the site Owners) approves it, buys it and finishes the request. Choose I will buy it myself only when you will buy it and submit your own receipts.
- Everything saves automatically. You can leave and come back.

### When the approver buys it

- On the Purchases step, add one row for each thing to buy: the vendor, what it is and why, an estimated amount, the category, and the web address of the item. Paste the address into "Item link". If there is no web page, say why in the "No web page: say why" box that appears. Nobody is asked who paid: the company pays for what the approver buys.
- The date starts as today. It is the day the purchase should be made; the approver sets the actual date when buying.
- For a vendor total of $500 or more, attach a quote (drop it into the box, or use the row menu and choose "Attach a quote"), or say why there is none in the "No quote: say why" box on the vendor's first row. You attach no receipt: the approver does that after buying.
- On Review and send, fix anything marked in red, then choose Send to the approver. Every request goes to the approver, whatever the amount. You tick the certification then (see Certification below), because you submit nothing afterwards.
- The request is locked and the approver is emailed. Its status is Awaiting approval. If the approver returns it, it shows as Returned with their note. Correct it and send it again.
- When it is approved, the approver buys it, attaches the receipt and marks it purchased. You have nothing more to do. The status changes to Purchased and then to Processed.

### Adding purchases

- On the Purchases step, add one row for each purchase: date, vendor, what was bought and why, category and amount, and who paid when you buy it yourself. Press Enter to move down a column. Ctrl+D copies the value from the row above.
- You can paste several rows from a spreadsheet. Put its columns in the order of the grid (date, vendor, what was bought and why, category, amount, and who paid when you buy it yourself), add enough rows first, click the cell where the first value goes, and paste. Write dates like 2026-10-14, 10/14/2026 or Oct 14, 2026, categories as they are named in the list, and amounts like 45.10. A value the app cannot read is not used, and a message says how many there were and why.
- Have the files? Drop them into the box at once (PDF, JPG, PNG or HEIC, up to 15 MB each). Each file becomes a row. When you buy it yourself, the switch in the box says whether the files are receipts or invoices, or quotes. When the approver buys it, the box takes quotes only.
- When you buy it yourself, the app reads each receipt or invoice and fills in the date, amount and vendor it finds. For a vendor you have used before, typed or read, it also fills in the category and who paid last time. Values taken from the receipt, and a "Who paid" changed this way, are highlighted: check each one against the receipt, correct anything wrong, then click Confirm on the row. A row with highlighted values cannot be sent or submitted until you confirm it.
- The app only fills in empty boxes: anything you typed stays as you typed it. Quotes, unclear photos and HEIC files are not read; type those rows yourself. Receipts are read on your own computer; nothing is sent anywhere else to read them.
- One receipt for several purchases (for example one invoice for two items)? Add a row for each purchase, then use the row menu (the three dots) and choose "Same receipt as row". A row that holds its own receipt file cannot also use another row's.
- Another file for a row, such as a quote or a second page? Use the row menu and choose "Attach a receipt or invoice" or "Attach a quote".

### When you buy it yourself: approval and quotes

- Approval is worked out by vendor within one request. If the purchases from one vendor add up to $500 or more, you need the approver's approval before you buy. Splitting a purchase across rows does not avoid it. The Vendor totals table on the Purchases step shows each vendor's total and what it needs.
- For a vendor total of $500 or more, attach a quote (drop it as a quote, or use the row menu), or say why there is none in the "No quote: say why" box on the vendor's first row.
- When the request is ready, go to Review and submit and choose Send for approval. The request is locked and the approver (the site Owners) is emailed. Its status is Awaiting approval.
- If the approver returns the request, it shows as Returned with their note. Correct it and send it for approval again.
- Once it is approved, you can buy. Then attach your receipts and invoices, and submit (see Submitting).
- If a vendor total later rises more than 10% above the amount that was approved, or another vendor reaches $500, send the request for approval again. A small rise (for example tax or shipping) and any lower amount do not need approval again.
- If every vendor total is under $500, no approval is needed. You still submit the request with your receipts.

### Bought something before approval?

- If you buy it yourself and a purchase of $500 or more has already been made, you can still send the request for approval. The app flags it as "Bought before approval" when a row is dated before today or already has a receipt or invoice attached.
- The approver and the administrator both see the flag. The approver still has to approve the request, and may return it.
- Ask for approval before you buy whenever you can. When the approver buys it, nothing is flagged.

### Categories

Each category is a QuickBooks account, named exactly as it is in QuickBooks, so your choice is the account. You suggest a category for each row. The approver, when approving, or the administrator can confirm or change it. Equipment is account 6175, or 1415 Fixed Assets:Equipment if it is capitalized, and Other has no account: the administrator decides both, and confirms them before the request is processed. Choose Other only when nothing fits, and describe the category in the box that appears.

- R&D Materials & Supplies: Materials and supplies for research and development work.
- Equipment: Equipment. The administrator decides whether it is expensed or capitalized.
- Advertising/Marketing/Website: Advertising, marketing materials, and website or domain costs.
- Computer, H/W & S/W Supplies: One-time computer hardware and software. Recurring software goes under Dues and Subscriptions.
- Office Supplies: Everyday office supplies.
- Training and Education: Courses, training and educational materials. Conference travel goes through the travel app.
- Shipping/Postage: Shipping and postage.
- Business Insurance: Business insurance premiums.
- Dues and Subscriptions: Recurring subscriptions, including software, and memberships.
- Telephone/Internet: Telephone and internet service.
- Repairs & maintenance: Repairs and maintenance.
- Professional Services: Professional services. The administrator picks the specific account in QuickBooks.
- Other: Anything that fits none of the above. Describe it; the administrator decides the account.

### Who paid

You are asked who paid only when you buy it yourself. When the approver buys it, the company pays.

- Company: Paid by Clarus (company card or invoice). Not reimbursed to you.
- Employee: You paid, so Clarus reimburses you.

### No receipt?

When you buy it yourself, every row needs a receipt or invoice before you submit, or a reason there is none, for example "Receipt lost". Type the reason in the "No receipt: say why" box on the row. A quote is not a receipt. Use "Add purchase without a file" to add a row you will fill in by hand. When the approver buys it, the approver attaches the receipts.

### Submitting

- This is for a request you buy yourself. When the approver buys it, you send it to the approver and submit nothing.
- On Review and submit, fix anything marked in red, and confirm any rows the app filled in. Amber items are warnings: check them, but you can still go on.
- To submit, tick the certification: "I certify that the listed purchases are for official Clarus Labs business purposes, are not personal expenses, have not been reimbursed elsewhere, and that the information provided is accurate to the best of my knowledge." It is recorded with your account; no signature is needed.
- After you submit, the request is locked. The administrator is emailed and a folder with your receipts, quotes and a spreadsheet of the purchases is created for processing.
- If the administrator returns the request, you will see their note. Correct it and submit again.

### Certification

You certify the request with this sentence: "I certify that the listed purchases are for official Clarus Labs business purposes, are not personal expenses, have not been reimbursed elsewhere, and that the information provided is accurate to the best of my knowledge." It is recorded with your account; no signature is needed. When the approver buys it, you tick it when you send the request to the approver. When you buy it yourself, you tick it when you submit.

### For the approver: approving and buying

- Under Approvals, "Waiting for approval" lists the requests sent to you, and "To buy" lists the approved requests that are waiting to be bought, with "You" beside the ones you approved (only the Owner who approved a request can buy it). You also get an email for each request sent for approval.
- Open a request to read it. Item links open the item in a new tab; only a web address that starts with https:// or http:// is a link. Approve confirms the categories shown (change one first if it is wrong) and records every vendor total as approved. Or return it with a note.
- To buy it, open the approved request and choose Open to buy. Change each row to what you bought: the vendor, the amount, the date, and extra rows for shipping or tax. The rows as the employee sent them stay on the page. You may spend more than was approved.
- Attach the receipt or invoice to each row (row menu, "Attach a receipt or invoice"), or point rows that share one at it ("Same receipt as row"). On Review and mark purchased, choose Mark purchased. A folder with the receipts, the quotes and a spreadsheet is made for the administrator, who is emailed.
- If you cannot buy it, return it to the employee with a note from its page. Delete any rows you added first. If the administrator returns it to you after you marked it purchased, fix it and mark it purchased again.
- Only the approver who approved a request buys it. Another site Owner can read it and can return it to the employee with a note, so it is never stuck, but cannot change its rows or mark it purchased.

### What this app does not cover

- Travel: use the Travel app.
- Foreign currency: enter the dollar amount from your card or bank statement, and note the foreign amount in "What was bought and why".

<!-- Part A ends -->

---

## Part B. Approver and administrator

Both roles are held today by the site Owners (people with SharePoint's "Manage web site" permission); in practice, Max. Steps marked "(checkpoint)" are written or confirmed when the first version is installed on the test site, so they name the real screens.

### B1. When a request is sent for approval

1. You receive an email "Purchase approval needed: <name>, <business purpose> (PR-0042)". It lists the requester, department, business purpose, project or grant code, each vendor total that needs approval with its quote status, any **Bought before approval** flag, and a link. When you buy the request (the usual case) it says so, and every vendor total is listed, whatever the amount. The item links are not in the email; you open them in the app. It arrives a few minutes after the employee sends the request.
2. In the app, the request is under **Approvals** (the sidebar shows how many are waiting).

### B2. Approving or returning a request

1. In **Approvals**, open the request. Check the vendor totals, the lines, and the attached quotes or no-quote reasons. Click a file name on the Purchases tab to open the quote or receipt.
2. Confirm or change each category in the grid. The employee only suggested them.
3. Choose **Approve**. Approving confirms the categories shown and records each vendor total as approved at its current amount. You can add a note. When the request is one you buy, the dialog says "Approving means you buy it": it is then yours to buy (B2a). The categories are QuickBooks accounts; each one shows its account number below the drop-down.
4. Or choose **Return with a note** and say what needs correcting. The employee sees the note and sends the request again.
5. If the request is flagged **Bought before approval**, the purchase was already made. Approving it is your decision; the flag stays on the request and is passed to the administrator's email and the CSV.
6. You may approve your own request. It is recorded as self-approved.
7. For a request the employee buys: if a vendor total later rises more than 10% above the amount you approved, or a new vendor total of $500 or more appears, the employee has to send the request for approval again (strategy section 4). A request you buy stays approved whatever you change while buying it.
8. You approve what was sent. If the request was changed after it was sent (for example edited directly in SharePoint), Approve is refused with "This request was changed after it was sent for approval...". Return it with a note instead; the employee corrects it and sends it again.
9. After approval the employee can still change the business purpose and the project or grant code, and remove a quote, without a new approval (a known gap, `docs/QUESTIONS_FOR_MAX.md` question 22). The submission email shows the purpose and code as submitted; compare them with what you approved.

### B2a. Buying a request you approved (the usual case)

1. After you approve, the request is under **To buy** on the **Approvals** page (the list shows every approved request waiting to be bought, with **You** beside the ones you approved; the sidebar count is yours only). Open it and choose **Open to buy**. Only the Owner who approved the request can change it, attach files to it or mark it purchased; another Owner can view it.
2. Open each **Item link** (it opens in a new tab) and buy the item. Back in the app, change each row to what you actually bought: the vendor, the description, the amount, the date. Add a row for anything the employee did not ask for, such as shipping or tax. Attach the receipt or invoice to each row with the row menu; one receipt can cover several rows ("Same receipt as row"). The rows as the employee sent them stay on the page under **As sent for approval**, so you and the administrator can see what changed.
3. Choose **Next: Review**, then **Mark purchased**. The dialog says the employee certified the request when they sent it, so you tick nothing. The app builds the folder and CSV and emails the administrator (B3). The status shows as **Purchased**.
4. If you cannot buy it, choose **Return to the employee** with a note. This takes the approval back. It is refused while rows you added are on the request; delete them first. Any other Owner can also return it if you cannot act, unless rows you added are on it: they ask you to delete those rows first.
5. If **Mark purchased** says the employee's certification is missing, return the request to the employee: they send it again with the certification ticked.
6. The employee does not see the rows you add (SharePoint shows people only the items they created; Unverified, checked at the test-site checkpoint). Receipts you attach to a row the employee made stay visible to them. The employee's list shows the request's stored total, which includes your rows; the request page adds up only the rows they can see.

### B3. When a request is submitted

1. You receive an email: "Purchase request submitted: <name>, <business purpose> (PR-0042)", or "resubmitted" with the submission number. For a request the approver bought it says "Purchase request bought" (or "bought again") and names the approver as the buyer. It lists the submitter and their account, the department, business purpose and project or grant code, the purchase dates, **To reimburse**, **Paid by Clarus** and **Request total**, the number of receipts and quotes, rows without a receipt, any warnings, the approval (who, when, and any note), any **Bought before approval** flag, and the employee's certification, with links to the folder, `Purchases_To_Process` and the request in the app. It arrives a few minutes after the employee submits.
2. The request folder is in `Accounting/Purchases/Purchases_To_Process/`, named `YYYY-MM-DD_Employee-Name_Business-Purpose_PR-0042` (earliest purchase date). A resubmission ends in `_R2`, `_R3`.
3. The folder holds a copy of each receipt (`R01_<original name>`, a second file on the same row `R01-2_...`), a copy of each quote (`Q01_<original name>`), and one CSV file, `PR-0042_Purchases.csv`.
4. In the app, the request is under **Requests to process**.

The app and the flow never change, move or delete anything else in the Accounting folder. They only create new folders and files inside `Purchases_To_Process`.

### B4. Processing

1. Process the folder with the receipt skill and enter the purchases in QuickBooks as set out in `Clarus_Accounting_SOP.md`. The CSV gives the QuickBooks account for each row, the number and the exact name (P-038). The accounts come from the May 1, 2026 account list and are to be compared with a fresh export before go-live. For **Equipment** you decide whether to expense it or capitalize it to 1415 Fixed Assets:Equipment; for **Other** you decide the account. **Mark processed** is refused while a row in one of those categories is unconfirmed (use **Confirm categories** first). The CSV also has the item link, who bought it, and the reason there is no link.
2. Rows paid by the **Employee** are the ones to reimburse. The "To reimburse" total in the email and the app is their sum. When the approver buys, the company pays every row and To reimburse is $0.00.
3. You can confirm or change a row's category in the app. The CSV already in the folder keeps the category as it was submitted.

### B5. Filing and marking processed

1. Move the request folder from `Purchases_To_Process` into `Accounting/Purchases/<year>/`, using the year of the earliest purchase date. Create the year folder the first time it is needed, for example in January.
2. In the app, open the request and choose **Mark processed**. This only changes the request's status; no email is sent.

### B6. Returning a request for correction

1. In the app, open the request, choose **Return with a note**, write what needs correcting, and choose **Return request**. The employee sees the note. For a request the approver bought, the request goes back to the approver (status Approved), not to the employee, who cannot change what the approver bought; the approver fixes it and chooses **Mark purchased** again.
2. Delete that request's folder from `Purchases_To_Process`. The corrected request arrives as a new folder ending in `_R2`.

### B7. Needs attention and failed packages (checkpoint)

- **Needs attention** in the app lists submissions whose folder was not created within 30 minutes, approval emails that were not sent within 30 minutes, and anything that failed. It also lists possible duplicates between two employees' requests, which only you can see.
- A failure also sends you an email. Open the request (from Needs attention) and choose **Retry packaging** (or **Retry approval email** for an approval). Retry works only on a submission that failed or has not changed for 30 minutes, while its request is still waiting for approval (an approval email) or submitted (a package); the request page shows the button exactly then, and a Retry starts the 30 minutes again. If an approval email had been sent before the failure, the approvers may get it twice.
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

To be completed from the test-site runs at the checkpoint. These messages are written from the code; the checkpoint does not trigger them. The app shows a refusal as it is written here.

| What you see | What it means | What to do |
|---|---|---|
| "This request was changed after it was sent for approval, so it cannot be approved as it stands." (approver) | The vendor totals no longer match what was sent | Return the request with a note; the employee sends it again |
| "Only an approval email or a package that failed, or that has not finished after 30 minutes, can be tried again." (administrator) | The page was out of date: the submission had been retried or finished since it was loaded | Reload the page |
| "The request has moved on since this was sent, so it cannot be tried again." (administrator) | The request was approved, returned or processed since the page was loaded | Nothing to retry |
| "This request needs approval first." (employee) | The request changed while the page was open, so a vendor total is now over what was approved | Reload the page; the Review step then says what changed, and the button reads Send for approval |
| "Only the approver who approved this request can change it, attach files to it or mark it purchased." (administrator) | Another Owner approved it | Ask the Owner who approved it. If they cannot buy it, you can return it to the employee with a note. Handing a request to another Owner is not built |
| "Max Wamsley added row N to this request while buying it, so it cannot be returned yet." (administrator) | The Owner who was buying it added a row, which would be left behind | Ask them to delete the row, then return the request |
| "The employee's certification is missing from this request." (approver) | The employee's approval request does not hold the exact certification sentence | Return the request to the employee; they send it again with the certification ticked |
| "You added row N to this request, so it cannot be returned yet." (approver) | Returning an approved request takes the approval back, and rows you added would then stop counting | Delete the rows you added, then return it |
| "Confirm the category of row N first: the account depends on a decision." (administrator) | The row is Equipment or Other and nobody has confirmed its category | Use Confirm categories, then Mark processed |
| "Row N has no receipt of its own to share." (employee) | The row points at a row that has no receipt | Choose a row that has one, or attach a receipt |
| "This row has a receipt of its own." (employee) | A row cannot hold its own receipt and also use another row's | Remove its own receipt first |

---

## Revision history

| Date | Stage | Change |
|---|---|---|
| 2026-09-30 | 1 | Started. Part B drafted from decisions P-001 to P-031; Part A is generated from the in-app Instructions at Stage 7 |
| 2026-10-01 | 10a | The approver-buys build: "Rules confirmed by Max" now holds who buys, the item link and the QuickBooks categories; Part A regenerated from the new Instructions; Part B gained B2a (buying a request you approved) and changed B1 to B6; Part C gained four refusals |
| 2026-10-01 | 5 to 9 | Part A generated from the Instructions (Stage 5). Part B brought up to date with the built screens and the review fixes (opening quotes, approving what was sent, Retry rules); Part C started from the app's own messages |
