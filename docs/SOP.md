# Purchase Requests: standard operating procedure

**Status:** Draft, started 2026-09-30 in the overnight build. It describes the app as designed and built so far. The app is not installed anywhere yet, so nothing here is in use. This file is updated at every stage and proofread in full at Stage 12 (see `docs/STRATEGY.md` section 14).

**Owner:** Max Wamsley (administrator and approver).

**Scope:** non-travel purchase requests only. Travel goes to the Travel app. This SOP does not change `Clarus_Accounting_SOP.md`, which governs processing in QuickBooks, and it does not replace a purchasing policy: Max will write a new one with Claude after the app is complete (strategy, last stage).

**Training:** every employee who can submit a request takes the SOP quiz (15 questions, 14 correct to pass) and can retake it. Quiz link: [INSERT QUIZ LINK.]

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
- **Equipment (closed in the policy workshop, P-044):** QuickBooks has no minimum cost for Equipment, so there is no capitalization threshold; the administrator decides how it is booked.
- **The Ledger (P-052 to P-059, 2026-11-15 and 2026-11-16).** Bookkeepers give each bought line a QuickBooks account and a class, from QuickBooks' own lists exported 2026-11-15, and mark it Posted in the app (Part D). QuickBooks needs a class on every line, so a line cannot be posted without one. A copy of the ledger is saved every night, and receipts are kept in a permanent archive so their links keep working.

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
- Started a request you do not need? On My requests, choose Delete at the end of the draft's row and confirm. Only drafts can be deleted, and only by the person who made them. A deleted draft goes to the site's recycle bin, from where an Owner can restore it.
- The colored label on each request shows where it stands: Draft (light purple), Awaiting approval (amber), Approved (blue), Submitted (teal) or Purchased (purple), Returned (orange) and Processed (green).

### When the approver buys it

- On the Purchases step, add one row for each thing to buy: the vendor, what it is and why, the category, the quantity (Qty), the estimated price for all of them (Total), and the web address of the item. Paste the address into "Item link". If there is no web page, say why in the "No web page: say why" box that appears. Nobody is asked who paid: the company pays for what the approver buys.
- The date starts as today. It is the day the purchase should be made; the approver sets the actual date when buying.
- For a vendor total of $500 or more, attach a quote (drop it into the box, or choose "+ Quote" in the row's Files column), or say why there is none in the "No quote: say why" box on the vendor's first row. You attach no receipt: the approver does that after buying.
- On Review and send, fix anything marked in red, then choose Send to the approver. Every request goes to the approver, whatever the amount. You tick the certification then (see Certification below), because you submit nothing afterwards.
- The request is locked and the approver is emailed. Its status is Awaiting approval. If the approver returns it, it shows as Returned with their note. Correct it and send it again.
- When it is approved, the approver buys it, attaches the receipt and marks it purchased. You have nothing more to do. The status changes to Purchased and then to Processed.
- Sent it by mistake, or want to change it? While it is still Awaiting approval, open it and choose Unsend. It becomes a draft again, which you can change and send again. The approver already got the email, which cannot be recalled, but they cannot approve a draft. Once the approver has approved or returned it, it cannot be unsent: ask the approver to return it.

### Adding purchases

- On the Purchases step, add one row for each purchase: date, vendor, what was bought and why, category, quantity (Qty), the price for all of them (Total), and who paid when you buy it yourself. Total is always the whole row, so 2 items at $10 each is Qty 2 and Total 20.00. Press Enter to move down a column. Ctrl+D copies the value from the row above.
- You can paste several rows from a spreadsheet. Put its columns in the order of the grid (date, vendor, what was bought and why, category, amount, and who paid when you buy it yourself), add enough rows first, click the cell where the first value goes, and paste. Write dates like 2026-10-14, 10/14/2026 or Oct 14, 2026, categories as they are named in the list, and amounts like 45.10. A value the app cannot read is not used, and a message says how many there were and why.
- Have the files? Drop them into the box at once (PDF, JPG, PNG or HEIC, up to 15 MB each). Each file becomes a row. When you buy it yourself, the switch in the box says whether the files are receipts or invoices, or quotes. When the approver buys it, the box takes quotes only.
- When you buy it yourself, the app reads each receipt or invoice and fills in the date, amount and vendor it finds. For a vendor you have used before, typed or read, it also fills in the category and who paid last time. Values taken from the receipt, and a "Who paid" changed this way, are highlighted: check each one against the receipt, correct anything wrong, then click Confirm on the row. A row with highlighted values cannot be sent or submitted until you confirm it.
- The app only fills in empty boxes: anything you typed stays as you typed it. Quotes, unclear photos and HEIC files are not read; type those rows yourself. Receipts are read on your own computer; nothing is sent anywhere else to read them.
- You need only one receipt for each vendor in a request. If you list the same vendor on several rows, attach the receipt or invoice to any one of them and the other rows show "Row N receipt", meaning they use that row's receipt. The vendor is matched by name, ignoring capitals, spaces and punctuation, so "Acme Lab Supply" and "Acme Lab Supply Inc" are different vendors. For one receipt that covers rows with different vendor names, use the row menu (the three dots) and choose "Same receipt as row". A row that holds its own receipt file cannot also use another row's.
- Each row has a "+ Receipt" button in its Files column: choose it to attach that row's receipt or invoice. Another file for the row, such as a second page? Choose the small + beside the first file. A quote? Use the row menu (the three dots) and choose "Attach a quote".

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

Each category is a QuickBooks account, named exactly as it is in QuickBooks, and the list shows its number with its name (for example 6182 R&D Materials & Supplies), so your choice is the account. You suggest a category for each row. The approver, when approving, or the administrator can confirm or change it. Equipment is account 6175, or 1415 Fixed Assets:Equipment if it is capitalized, and Other has no account: the administrator decides both, and confirms them before the request is processed. Choose Other only when nothing fits, and describe the category in the box that appears.

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

When you buy it yourself, every vendor needs a receipt or invoice on one of its rows before you submit, or a reason there is none, for example "Receipt lost". Type the reason in the "No receipt: say why" box on the row. A quote is not a receipt. Use "Add purchase without a file" to add a row you will fill in by hand. When the approver buys it, the approver attaches the receipts.

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
- To buy it, open the approved request and choose Open to buy. Change each row to what you bought: the vendor, the quantity, the total, the date. For shipping and tax, type them from the receipt in the Shipping and Tax boxes beside the vendor in Vendor totals. Each makes a row (shipping in Shipping/Postage, tax in the category of that vendor's largest purchase) that you can still change, and an emptied box removes it. Use Add another row for anything else. The rows as the employee sent them stay on the page. You may spend more than was approved.
- Attach each vendor's receipt or invoice to one of its rows (the "+ Receipt" button in its Files column): it covers all of that vendor's rows, including shipping and tax. Use "Same receipt as row" only when one receipt covers rows with different vendor names. On Review and mark purchased, choose Mark purchased. A folder with the receipts, the quotes and a spreadsheet is made for the administrator, who is emailed.
- If you cannot buy it, return it to the employee with a note from its page. Delete any rows you added first. If the administrator returns it to you after you marked it purchased, fix it and mark it purchased again.
- Only the approver who approved a request buys it. Another site Owner can read it and can return it to the employee with a note, so it is never stuck, but cannot change its rows or mark it purchased.
- Bought something yourself and need it on record? Choose Record a purchase, at the top of Approvals or Requests to process. Add a row for each purchase, attach the receipt or invoice (one per vendor is enough) and choose Record purchase. There is no approval and no certification: it goes straight to Requests to process with its folder and spreadsheet, marked as recorded by you. Only administrators see this button.

### For bookkeepers: the Ledger

Administrators and members of the Purchase Bookkeepers group see Ledger in the sidebar. It lists every purchase line of a request that has been bought, ready to enter in QuickBooks. Each line shows the request, the vendor, what was bought, the total and who paid, a link to the receipt, a QuickBooks account and a class.

- Choose the account and the class from the lists. Click a box, then choose from the list or type to narrow it: type an account number (6182) or any word (ship, supplies). The list is shown in layers so the likeliest choice is on top: From this request (the line's own category), Used for this vendor before, Used most often, Usual for Clarus, and All other accounts. An item shows once, at the highest layer it fits. The layers only decide the order; nothing is filled in for you, and you always choose the class.
- QuickBooks needs a class on every line, so a line cannot be marked Posted until it has an account and a class.
- When you have entered lines in QuickBooks, tick them and choose Mark Posted. Posting records your name and the time. If one selected line cannot be posted, none is, and the message names it. A Posted line is locked: choose the Posted tab, tick it and choose Set back to Not posted to change it.
- Each line has a note box under its description, for things like "split with PR-0042 row 2". A note saves when you click away or press Enter, and can be written at any time, even on a Posted line.
- To give several lines the same account or class, tick them, choose the account and class in the bar that appears and choose Apply. Only what you choose is changed, Posted lines are left out, and if any selected line cannot be changed, none is.
- Show only narrows a tab to the lines that Need a class, Need an account, Changed since posted, or where the Administrator decides (Equipment and Other lines whose account has not been confirmed). Sort by changes the order: request, vendor, purchase date or amount. The number beside Ledger in the sidebar is how many lines are still not posted.
- If a Posted line was changed afterwards (a request was returned and fixed, say), the Ledger shows a red note "Changed since posted: was $X, now $Y" and a warning at the top. Check QuickBooks, then either set the line back to Not posted and post it again, or add a note.
- Click a receipt to open the copy kept in the receipt archive. A request bought before the archive existed links to its request folder instead, which stops working when the folder is filed under its year.
- Download Excel saves the lines you are looking at (the tab and the search) as an Excel file, with a clickable link to each receipt. A copy of the whole ledger is also saved every night in Accounting, Purchases, Ledger_Backups.

### What this app does not cover

- Travel: use the Travel app.
- Foreign currency: enter the dollar amount from your card or bank statement, and note the foreign amount in "What was bought and why".

<!-- Part A ends -->

---

## Part B. Approver and administrator

Both roles are held today by the site Owners (people with SharePoint's "Manage web site" permission); in practice, Max and, since 2026-11-22, TyWamsley (an Owner who does the bookkeeping). Steps marked "(checkpoint)" are written or confirmed when the first version is installed on the test site, so they name the real screens.

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
2. Open each **Item link** (it opens in a new tab) and buy the item. Back in the app, change each row to what you actually bought: the vendor, the description, the quantity, the total, the date. Shipping and tax: type them from the receipt in the Shipping and Tax boxes beside that vendor in Vendor totals. One receipt per vendor is enough: attach it to any one of that vendor's rows and it covers the vendor's other rows, including shipping and tax. Add a row for anything the employee did not ask for, such as shipping or tax. Attach the receipt or invoice to each row with the row menu; one receipt can cover several rows ("Same receipt as row"). The rows as the employee sent them stay on the page under **As sent for approval**, so you and the administrator can see what changed.
3. Choose **Next: Review**, then **Mark purchased**. The dialog says the employee certified the request when they sent it, so you tick nothing. The app builds the folder and CSV and emails the administrator (B3). The status shows as **Purchased**.
4. If you cannot buy it, choose **Return to the employee** with a note. This takes the approval back. It is refused while rows you added are on the request; delete them first. Any other Owner can also return it if you cannot act, unless rows you added are on it: they ask you to delete those rows first.
5. If **Mark purchased** says the employee's certification is missing, return the request to the employee: they send it again with the certification ticked.
6. The employee does not see the rows you add (SharePoint shows people only the items they created; Unverified, checked at the test-site checkpoint). Receipts you attach to a row the employee made stay visible to them. The employee's list shows the request's stored total, which includes your rows; the request page adds up only the rows they can see.

### B2b. Recording a purchase you already made (P-051)

Use this when you bought something yourself and there is no request to approve.

1. Choose **Record a purchase** at the top of **Approvals** or **Requests to process**. Only administrators see this button.
2. Fill in **Request details** (business purpose and department), then **Next: Purchases**.
3. Add a row for each purchase (**Add a purchase**): date, vendor, what and why, category, quantity and total. Attach the receipt or invoice with **+ Receipt**, or drop it into the box. One receipt per vendor covers all of that vendor's rows. Type any shipping or tax in the vendor's **Shipping** and **Tax** boxes in **Vendor totals**.
4. Choose **Next: Review**, then **Record purchase**, then **Record purchase** in the dialog. There is no approval, no item link, no quote and no certification.
5. The request becomes **Purchased**, marked as recorded by you, and the folder and CSV are made in `Accounting/Purchases/Purchases_To_Process` as for any purchase. It shows under **Requests to process**; continue at B4.
6. It is locked once recorded. If something is wrong, return it from its page and fix it, then mark it purchased again.

### B3. When a request is submitted

1. You receive an email: "Purchase request submitted: <name>, <business purpose> (PR-0042)", or "resubmitted" with the submission number. For a request the approver bought it says "Purchase request bought" (or "bought again") and names the approver as the buyer. It lists the submitter and their account, the department, business purpose and project or grant code, the purchase dates, **To reimburse**, **Paid by Clarus** and **Request total**, the number of receipts and quotes, rows without a receipt, any warnings, the approval (who, when, and any note), any **Bought before approval** flag, and the employee's certification, with links to the folder, `Purchases_To_Process` and the request in the app. It arrives a few minutes after the employee submits.
2. The request folder is in `Accounting/Purchases/Purchases_To_Process/`, named `YYYY-MM-DD_Employee-Name_Business-Purpose_PR-0042` (earliest purchase date). A resubmission ends in `_R2`, `_R3`.
3. The folder holds a copy of each receipt (`R01_<original name>`, a second file on the same row `R01-2_...`), a copy of each quote (`Q01_<original name>`), and one CSV file, `PR-0042_Purchases.csv`.
4. In the app, the request is under **Requests to process**.

4a. The flow also copies each receipt (not the quotes or the CSV) into `Accounting/Purchases/Purchase_Receipts/<same folder name>/`. That archive stays where it is when you file the request folder, so the Ledger's receipt links keep working (P-058).

The app and the flows never change, move or delete anything else in the Accounting folder. They only create new folders and files, in three places: `Purchases_To_Process` (the request folders), `Purchase_Receipts` (the receipt archive) and `Ledger_Backups` (the nightly backup, Part D).

### B4. Processing

1. Process the folder with the receipt skill and enter the purchases in QuickBooks as set out in `Clarus_Accounting_SOP.md`. The CSV gives the QuickBooks account for each row, the number and the exact name (P-038). The accounts come from the May 1, 2026 account list and are to be compared with a fresh export before go-live. For **Equipment** you decide whether to expense it or capitalize it to 1415 Fixed Assets:Equipment; for **Other** you decide the account. **Mark processed** is refused while a row in one of those categories is unconfirmed (use **Confirm categories** first). The CSV also has the item link, who bought it, and the reason there is no link.
2. Rows paid by the **Employee** are the ones to reimburse. The "To reimburse" total in the email and the app is their sum. When the approver buys, the company pays every row and To reimburse is $0.00.
3. You can confirm or change a row's category in the app. The CSV already in the folder keeps the category as it was submitted.

### B5. Filing and marking processed

1. Move the request folder from `Purchases_To_Process` into `Accounting/Purchases/<year>/`, using the year of the earliest purchase date. Create the year folder the first time it is needed, for example in January.
2. In the app, open the request and choose **Mark processed**. This only changes the request's status; no email is sent.

### B5a. A request an employee unsent (P-050)

An employee can take back a request that is still **Awaiting approval**. It becomes a draft again and leaves **Approvals**. If you open the old email link, the page says the employee unsent it and offers no Approve or Return. The email cannot be recalled. When the employee sends it again it comes back under **Approvals** as the next round. A request you have already approved or returned cannot be unsent.

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
6. Under "3. Ledger backup flow", choose Download backup flow package (it uses the same Test or Live choice) and import it the same way. Turn it on. It runs every night at 2:30 a.m. Central time.
7. In SharePoint, create the group **Purchase Bookkeepers** and give it Edit permission on the three lists (Part D, D5). Add the bookkeepers to it.

---

## Part D. Bookkeepers: the Ledger (P-052 to P-060)

The Ledger is where the bookkeepers turn bought purchases into QuickBooks entries. It is open to administrators and to the members of the SharePoint group **Purchase Bookkeepers**. The employee pages and the approval pages are not open to a bookkeeper who is not an administrator.

### D1. What the Ledger shows

- One row for each purchase line of a request that has been **bought and packaged** (status Submitted, which the app shows as Purchased when the approver bought it, or Processed). A line appears as soon as the package is made; it does not wait for you to mark the request processed. **Posted** and **Processed** are different: Processed means the request folder has been filed and the request closed; Posted means the line has been entered in QuickBooks.
- Per line: the request and row, the date, the vendor, what was bought, the total (and "Paid by company" or "To reimburse"), a link to the receipt, the QuickBooks **account** and the **class**.
- Tabs: **Not posted** (the usual one), **Posted** and **All**, with their counts, and a search over the request number, vendor, description, account, class and note. A long list is drawn 150 lines at a time ("Show more").
- **Show only** narrows a tab to **Needs a class**, **Needs an account**, **Changed since posted** or **Administrator decides**, each with the number of lines it would show. **Sort by** orders the lines by request (newest first, the usual), vendor, purchase date or amount.
- A **note box** under each line's description, and a count beside **Ledger** in the sidebar: the number of lines still not Posted (it refreshes every minute and whenever you change the Ledger).

### D2. Working through it

1. Open **Ledger**. Open a line's receipt (it opens in a new tab) and check the line.
2. Choose the **account** and the **class**. A line starts with the account of its category (for example 6182 R&D Materials & Supplies for an R&D Materials line); change it if QuickBooks should have another. The class is always your choice. **QuickBooks needs a class on every line**, so a line cannot be posted without one.
3. Enter the line in QuickBooks as set out in `Clarus_Accounting_SOP.md`, then tick it and choose **Mark Posted**. You can tick many lines and mark them together. The app records your name and the time.
4. If one line you ticked cannot be posted (it has no class, say), **none** is posted, and the message names the line. Fix it and try again.
5. A **Posted** line is locked. To change one, open the **Posted** tab, tick it and choose **Set back to Not posted**; its account and class stay, and the name and time are cleared. Then change it and post it again.
6. **A note** can be written on any line, Posted or not (for example "split with PR-0042 row 2"). It saves when you press Enter or click away. It changes nothing that was posted.
7. **Apply to selected lines.** Tick lines that are not Posted, choose an account, a class or both in the bar that appears, and choose **Apply to N**. Only what you choose changes. Posted lines you ticked are left out. If any selected line cannot be changed, none is.
8. **Show only: Administrator decides.** An amber tag on Equipment or Other lines whose account depends on Max's decision and is not confirmed yet. Leave these until Max says which account (for example 6175 Equipment, or 1415 Fixed Assets:Equipment).

### D2a. Warnings

- **Needs a class** or **Needs an account** under a line's status: it cannot be marked Posted yet.
- **Changed since posted: was $X, now $Y** (a red note on the line, and an amber banner at the top of the page). The app records the line's amount when you mark it Posted. If the line's amount later differs (a returned request was fixed, or someone edited the line in SharePoint), QuickBooks may no longer agree. Check QuickBooks, then either set the line back to Not posted and post it again, or add a note saying why it stands. The banner's **Show them** button lists only those lines. Lines posted before this check existed have no recorded amount and are never flagged.
- **request folder** under a receipt: see D4.

### D3. How the account and class boxes work

Click a box. A list opens. You can choose with the mouse, or use the arrow keys and Enter, or just type. **Typing narrows the list**: type a number (`6182`), a word (`ship`, `supplies`), or several words (`office supplies`), in any case. Every word you type must appear in the account's number or name. Escape closes the list and keeps what was chosen. Only an item from the list can be chosen, so the account and class are always exactly as QuickBooks has them.

The list is shown in **layers**, so the choice you most likely want is at the top. Each layer has a heading. An item is shown only once, at the highest layer it fits:

1. **From this request.** The account of the line's own category. (Accounts only.)
2. **Used for this vendor before.** What a bookkeeper posted the last time for the same vendor. The vendor is matched the way the vendor totals match it, so "ACME lab supply" and "Acme Lab Supply" are the same vendor.
3. **Used most often.** The accounts (or classes) the company has posted most, at most five.
4. **Usual for Clarus.** The order Max chose for an R&D company, below. A new site starts here.
5. **All other accounts.** The rest of the list, by account number. (Accounts only; every class is in layer 4.)

**A worked example.** A line from Northside Lab Supply, category Office Supplies. The bookkeepers have posted Northside before, mostly to 6184 Shipping/Postage, and the company posts 6180 Office Supplies and 6184 most often. The account list opens as: *From this request:* 6180 Office Supplies. *Used for this vendor before:* 6184 Shipping/Postage. *Used most often:* then whichever of the company's top five are not already shown. *Usual for Clarus:* 6182 R&D Materials & Supplies, 6178 Computer, H/W & S/W Supplies and so on. *All other accounts:* the rest by number. If you type `ship`, only 6184 Shipping/Postage remains, still in its layer.

**What the suggestions do not do.** They only decide the **order**. Nothing is filled in because of them, and no line is ever posted by them. They never use anything but the 500 lines posted most recently, so they follow the way the company posts now, and the page stays fast: the counting is done once when the page opens, a box builds its list only when you open it, and typing filters about 56 items already in memory.

**Max's order of accounts (layer 4, then the rest by number):** 6182 R&D Materials & Supplies; 6178 Computer, H/W & S/W Supplies; 6180 Office Supplies; 6184 Shipping/Postage; 6150 Dues and Subscriptions; 6500 Advertising/Marketing/Website; 6175 Equipment; 1415 Fixed Assets:Equipment; 6215 Business Insurance; 6050 Professional Services; 6155 Training and Education; 6170 Repairs & maintenance; 6185 Telephone/Internet; 5050 COGS Expenses:Materials & Supplies.

**Max's order of classes:** 5.0 Internal R&D; 1.0 Grants:1.01 NSF Phase 1 SBIR; 1.0 Grants:1.03 NSF Phase 2 SBIR; 1.0 Grants:1.02 X Competition; 8.0 Indirect Expenses; 2.0 Commercial; 9.0 Unallowable Expenses. The 1.0 Grants parent and 3.0 Other Income are not offered.

**The lists come from QuickBooks.** The 56 accounts are the numbered Expense, Cost of Goods Sold and Other Expense accounts, plus 1415 Fixed Assets:Equipment, from the Account List exported on 2026-11-15; the 7 classes are from the Class list exported the same day. When QuickBooks changes (a new account or class), tell the administrator: the lists are in the app and are changed with a new version.

### D4. Receipts and the Excel download

- A receipt link opens the copy in `Accounting/Purchases/Purchase_Receipts/<request folder name>/`. Filing the request folder under its year does not move this copy, so the link keeps working. A request packaged before the archive existed links to its request folder, which stops working once it is filed (the Ledger marks these "request folder").
- **Download Excel** saves the lines you are looking at (the tab and the search) as an Excel file: Posted first, then who and when, the request, the purchase, the QuickBooks account and class, the total, who paid, a clickable receipt link and the rest of what the bookkeeper needs. Text is saved as text, so nothing in it can run when the file is opened.

### D5. Setting up bookkeepers (administrator, once)

The Ledger works for a person only if SharePoint lets them in, which is a Microsoft 365 change Max makes (steps in `docs/UPDATE_1.0.3.0.md`):

1. Create a SharePoint group named exactly **Purchase Bookkeepers** on the Forms and Apps site, and add the bookkeepers to it.
2. Give the group **Edit** permission on the three lists (Purchase Requests, Purchase Request Lines, Purchase Submissions). Edit lets them read every employee's line and change the Ledger columns. It does not let them approve a request (that needs "Manage web site").
3. Give the group **Read** access to `Accounting/Purchases/Purchase_Receipts`, so the receipt links open.
4. **The other way: make the bookkeeper an Owner (used for TyWamsley, 2026-11-22, P-061).** Owners are administrators in the app, so an Owner sees the Ledger and can post lines without being in the group. The trade-off: an Owner is also an approver and sees Approvals, Requests to process, Needs attention, All requests, Set-up and Record a purchase, and can approve and buy requests (only the Owner who approved a request can buy it). Choose it only for a person you trust with spending. After adding an Owner, make a new flow package from Set-up and import it, so the approval email also reaches them (B9). To keep a bookkeeper to the Ledger alone, use the group in steps 1 to 3 instead and do not add them as an Owner.
5. A bookkeeper outside the company needs a guest account in your Microsoft 365. That depends on your tenant's external-sharing settings (Unverified) and is not set up. There is no separate username and password for the app: everyone signs in with a Microsoft identity.

Unverified until the Test site: that SharePoint tells the app which groups the signed-in person is in, and that Edit on the lists lets a bookkeeper read every employee's items despite "own items only".

### D6. The nightly backup

A second flow saves a copy of the ledger every night at 02:30 Central time, in `Accounting/Purchases/Ledger_Backups/`: a CSV and a Markdown file named `Ledger_<date>_<time>`. Each holds every purchase line of every request that has been bought, with the account, class, Posted, who and when. **Each night is a new pair of files: nothing is overwritten, moved or deleted**; delete old ones yourself when you wish. If a night fails, you are emailed and nothing is changed.

If a list were ever damaged or lines lost, the newest backup is the record of the account, class and Posted status. The Markdown file can be read by an AI (for example to help re-enter the status); the CSV opens in Excel. The Ledger in the app is the live record; the files are the copy.

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
| "A note can be at most 255 characters." (bookkeeper) | A note is longer than a one-line SharePoint text column holds | Shorten it |
| "Only administrators and members of the Purchase Bookkeepers group can use the Ledger." | The person is not an administrator and SharePoint did not report them in the group | Check they are in the group exactly named Purchase Bookkeepers, then reload the page |
| "PR-0042 row 1: choose a class before posting. QuickBooks needs one on every line." (bookkeeper) | The line has no class | Choose a class, then mark it Posted. When several lines were ticked, none was posted |
| "PR-0042 row 1 is Posted. Set it back to Not posted before changing its account or class." (bookkeeper) | A Posted line is locked | Use the Posted tab, tick it and choose Set back to Not posted |
| "PR-0042 row 1: its account is not in the account list. Choose the account again before posting." (bookkeeper) | Something other than a listed account was typed into the list in SharePoint | Choose the account again from the list |
| "That purchase line is not in the Ledger. It may have been returned or removed." (bookkeeper) | The request was returned or the line deleted since the page was loaded | Reload the page |
| "Row N has no receipt of its own to share." (employee) | The row points at a row that has no receipt | Choose a row that has one, or attach a receipt |
| "This row has a receipt of its own." (employee) | A row cannot hold its own receipt and also use another row's | Remove its own receipt first |

---

## Revision history

| Date | Stage | Change |
|---|---|---|
| 2026-09-30 | 1 | Started. Part B drafted from decisions P-001 to P-031; Part A is generated from the in-app Instructions at Stage 7 |
| 2026-10-01 | 10a | The approver-buys build: "Rules confirmed by Max" now holds who buys, the item link and the QuickBooks categories; Part A regenerated from the new Instructions; Part B gained B2a (buying a request you approved) and changed B1 to B6; Part C gained four refusals |
| 2026-10-01 | 5 to 9 | Part A generated from the Instructions (Stage 5). Part B brought up to date with the built screens and the review fixes (opening quotes, approving what was sent, Retry rules); Part C started from the app's own messages |
| 2026-10-01 | 15 | Added the training quiz line (the link is a placeholder until the Form exists), P-045 |
| 2026-11-09 | 16 | Part A regenerated (quantity, one receipt per vendor, shipping and tax boxes, Unsend, Record a purchase); Part B gained B2b (recording a purchase) and B5a (an unsent request); P-047 to P-051 |
| 2026-11-16 | 17 | The Ledger (Part D), the receipt archive and the nightly backup (B3, B9, D4 to D6); Part A regenerated (account numbers in the category list, For bookkeepers: the Ledger); Part C gained five Ledger refusals; P-052 to P-059 |
| 2026-11-17 | 17 | Ledger polish folded into the same version: notes, the changed-since-posted warning, Apply to selected, Show only and Sort by, the Administrator decides tag, the sidebar count (D1, D2, D2a); Part A regenerated; Part C gained the note-length refusal; P-060 |
| 2026-11-22 | 17 | D5 gained the Owner route for a bookkeeper (what an Owner can also do, and the new flow package); the Owners today; P-061 |
| 2026-11-24 | 18 | Part A regenerated (Delete on My requests, the status colors); P-062 |

