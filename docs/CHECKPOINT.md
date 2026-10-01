# Checkpoint: first install on a test site

**For:** Max. **When:** whenever you are ready; nothing else waits on it except testing in SharePoint. **Time:** about 75 minutes in total (my estimate), plus short waits for the flow to run.

This is your one hands-on checkpoint before the pilot (P-014, as D-014 in travel). It installs the app on a new **test** site and imports a **test** flow. Test request folders go to the test site's own Documents library, not the Accounting folder (P-008). The Travel Expense app, the current Power Apps apps and their lists, the Accounting folder and QuickBooks are not touched. The test site is separate from the Forms and Apps site; the real site is chosen later.

Microsoft's screens change often, and I cannot see them from here, so a button may be worded slightly differently. If a step does not match what you see, stop and tell me what the screen shows.

**How the steps are grouped.** Parts 1 to 4 install everything (steps 1 to 15). Part 5 tries a small request that needs no approval. Part 6 tries the approval path, which is the new part of the flow, so those steps are the ones to watch closely (steps 21 to 31). Part 7 is optional: a failure test, a purchase bought before approval, and a colleague.

---

## Part 1. Create the test site

1. Go to `https://claruslabsusa.sharepoint.com` and choose **+ Create site**.
2. Choose **Communication site**, then the **Standard** or **Blank** design.
   - Recommended: a communication site creates no Microsoft 365 group or Teams team; people are added under Site permissions. A team site also works if you prefer.
3. Site name: **Purchase Requests Test**. Keep the suggested address (`/sites/PurchaseRequestsTest`). Choose **Create site** (or **Finish**).
   - **Optional, and the only way to prove Check 5 (step 13).** Add a colleague as a second owner now: **Settings**, **Site permissions**, **Add members**, **Add users**, and put them in the **Owners** group. The approval email in Part 6 should then go to both of you. Step 33 asks you to make a colleague a Member instead, so do that first, or use a different colleague. If you skip this, Check 5 can only show that your own address is used.

## Part 2. Add the app

4. Get the app package: open pull request MaxWamsley-ClarusLabs/clarus-purchase-requests#1 on GitHub, then **Checks**, then **Build**. On the run's **Summary** page, under **Artifacts**, download **clarus-purchase-requests-sppkg**. Unzip it to get `clarus-purchase-requests.sppkg`.
   - Use the newest run (the top commit of the pull request) and check that it has a green tick.
5. Open the SharePoint admin center (`https://claruslabsusa-admin.sharepoint.com`), then **More features**, then under **Apps** choose **Open**. You are now in the app catalog, **Manage apps**.
6. Choose **Upload** and select `clarus-purchase-requests.sppkg`.
7. In the **Enable app** panel, choose **Only enable this app**, then **Enable**. The app asks for no extra permissions.
8. Go to the test site. Choose the **Settings** gear, then **Add an app**. Under **From your organization**, choose **Clarus Purchase Requests**, then **Add**.
9. On the test site, choose **+ New**, then **Page**, then **Create blank**. Title the page **Purchase Requests**. Choose **+** in the empty section, search **Purchase Requests** (shopping cart icon, group Advanced), select it, and choose **Publish**.
   - If the search finds no **Purchase Requests**, steps 6 to 8 did not finish: check that the app is listed in the app catalog with **Enabled** and **Valid app package** both **Yes**, then that step 8 added it to this site (it shows in **Site contents**).

## Part 3. Create the lists

10. Open the **Purchase Requests** page. Because the site is new, you see only **Set-up**.
11. Under **1. Lists on this site**, choose **Create the lists**. Wait until all three show **Ready** (about a minute). The lists are **Purchase Requests**, **Purchase Request Lines** and **Purchase Submissions**.
    - If a list shows **Permissions not set**, follow the steps shown on the page, then choose **Check again**.
    - If a list shows **Address in use**, tell me which one. It means a list with that address already exists on the site, which should not happen on a new site.

## Part 4. Import the test flow

12. Still on **Set-up**, under **2. Flow package**, keep **Test** selected and choose **Download flow package**. You get `PurchaseRequests_Flow_Test.zip`.
13. A green box appears under the button. Read it, and write down (or screenshot) which addresses it lists after "Approval emails go to".
    - **Check 5 (new).** It should list the addresses of the site Owners: yours, and your colleague's if you added one in step 3. If you are the only Owner it lists only yours, and that looks the same as the fallback (the Set-up page uses your own address if it cannot read the Owners), so only a second Owner proves that the Owners were read.
14. Open `https://make.powerautomate.com`, then **My flows**, then **Import**, then **Import Package (Legacy)**. Choose **Upload** and select the file. On the import page:
    - Next to **Purchase Requests flow (test site)**, open **Import setup** and choose **Create as new**, then **Save**.
    - Next to the **SharePoint** connection, choose **Select during import**, pick your own account, then **Save**.
    - Do the same for **Office 365 Outlook**.
    - Choose **Import**.
    - **Check 1 (new).** The import finishes without an error. This is the first time a package with the new nesting (one If action holding two scopes) is imported.
15. Open **My flows**, open **Purchase Requests flow (test site)** and choose **Turn on**. (Imported flows start turned off.) Open the flow's details and check the status says **On**.
    - **Check 1 (continued).** The flow turns on. If Power Automate says the flow has an error, take a screenshot of the message and stop.

## Part 5. Try a request that needs no approval

A vendor total under $500 needs no approval, but the request is still submitted with its receipts. The two sample receipts used below are in the repository's `test/fixtures/receipts` folder (on GitHub, open the file and choose the download button), or use any image or PDF that holds nothing sensitive.

16. On the **Purchase Requests** page, choose **My requests**, then **New request**. On **Request details**, enter Department **Testing** and Business purpose **Checkpoint test, small purchase**. Leave **Project or grant code** empty. Choose **Next: Purchases**.
17. Drop `northwind-office-receipt.png` and `quickship-postage-receipt.png` into the box (leave the switch on **Receipts or invoices**). Each file becomes a row.
    - The app should read each receipt and fill in the date, vendor and amount, highlighted, with a **Confirm** button on the row. Choose **Confirm** on each. (If the reader did not run, type the values; tell me, because it is a separate check.)
    - Set **Who paid** to **Employee** on the Northwind row and **Company** on the QuickShip row, and choose a category for each (for example **Office Supplies** and **Shipping/Postage**).
    - The **Vendor totals** table under the grid should show both vendors under $500 with no approval needed.
18. Choose **Next: Review**. The **Approval** card should say **No approval needed**, the button at the top should say **Submit request** (not **Send for approval**), and nothing should be in red. Choose **Submit request**, tick the certification, and choose **Submit request** again.
19. Within about 5 to 10 minutes (the flow checks every few minutes):
    - an email **Purchase request submitted: ...** arrives, with the certification sentence in it;
    - the test site's **Documents** library has **Purchases_Test**, then **Purchases_To_Process**, then the request's folder, named like `2026-10-07_Your-Name_Checkpoint-test-small-purchase_PR-0001`, holding a receipt copy for each file (`R01_...` and `R02_...`, named after your two files) and `PR-0001_Purchases.csv` (the date and the number may differ);
    - in the app, **Requests to process** shows the request as **Packaged**.
    - Open the CSV. It should have one header row and two purchase rows, with 28 columns. For each row, check Category, Suggested QuickBooks account (these are my guesses, see `docs/QUESTIONS_FOR_MAX.md` question 1), Amount, Who paid, Reimbursable, and that Approval status says **Not required**.
20. In the app, open the request under **Requests to process** and choose **Return with a note**. Correct and resubmit it as the employee (**My requests**, the **Correct it** button on the banner). A second folder ending in `_R2` should appear, holding `PR-0001_R2_Purchases.csv`. Then choose **Mark processed** on it.

## Part 6. Try the approval path (the new part of the flow)

You are the only Owner of the site, so you will be both the employee and the approver. The app records this as **self-approved** (P-020). The approval email goes to the Owners' addresses fixed in the package, which is you.

21. **My requests**, then **New request**. Department **Testing**, Business purpose **Checkpoint test, approval**. Choose **Next: Purchases**.
22. Drop `acme-lab-supply-quote.pdf` into the box with the switch on **Quotes** (the box should not try to read it). The row shows $0.00 or an empty amount; type these values: date today, vendor **Acme Lab Supply**, what **Pipette tips and centrifuge tubes for the assay**, category **R&D Materials & Supplies / Equipment**, amount **640.00**, who paid **Company**.
    - The **Vendor totals** table should show Acme Lab Supply $640.00, **Approval needed**, **Quote attached**.
    - Optional: remove the quote and check the **No quote: say why** box appears on the row and **Next: Review** shows the problem in red until you type a reason.
23. Choose **Next: Review**. The **Approval** card says what needs approval, and the button at the top says **Send for approval**. Choose it. The dialog lists **Acme Lab Supply $640.00** and has no certification tick box. Choose **Send for approval**.
    - Sending clears the **Approved by** column and the return stage (the first time the app asks SharePoint to clear a person and a choice column; the Stage 4 notes in `docs/CHANGELOG.md` list this as Unverified). If you see an error message here, take a screenshot of it.
    - The request is now **Awaiting approval**, locked.
24. Within about 5 to 10 minutes:
    - **Check 2 (new).** In Power Automate, open **Purchase Requests flow (test site)**, then its run history, then the latest run. The step **If this is an approval request** should have taken the **Yes** (true) branch: a green tick on **Approval email**, and the packaging steps skipped. If it took the packaging branch, the flow read the type wrongly; take a screenshot of the run.
    - **Check 3 (new).** An email **Purchase approval needed: Your Name, Checkpoint test, approval (PR-0002)** arrives for each Owner address. It should list the requester, department, business purpose, the **Acme Lab Supply $640.00** total with its quote status, and the line "Open the request in Purchase Requests to approve it, confirm the categories, or return it with a note:" with a link. The link opens the request in the app.
    - In the app, **Approvals** shows the request, and the request page shows **Approver emailed**.
25. In the app, choose **Approvals**, open the request, and look at the **Approval email** tab. It should read the same as the email you received. Open the **Purchases** tab: the category should be a drop-down. Change the category to **Computer, H/W & S/W Supplies** to see that a change is recorded.
26. Choose **Approve**. The dialog says **You changed 1 category.** and takes an optional note. Type **Checkpoint note** and choose **Approve request**. The request is **Approved**, and **My requests** shows a green banner with your name as the approver (and the words self-approved on the request page).
27. As the employee, open the request again. It is editable, and each row now asks for a receipt. On the Acme Lab Supply row, open the row menu (the three dots), choose **Attach a receipt or invoice**, and pick `acme-lab-supply-invoice.pdf`. Then go to **Review and submit**. The button now says **Submit request**. Submit it with the certification.
28. Within about 5 to 10 minutes:
    - the email **Purchase request submitted: ...** arrives. It should include a line like **Approval: approved by Your Name (self-approved) on <date and time>. Note: Checkpoint note**;
    - the request folder (named for the purchase date, with `_PR-0002`) holds `R01_acme-lab-supply-invoice.pdf`, `Q01_acme-lab-supply-quote.pdf` and `PR-0002_Purchases.csv`;
    - in the CSV, the row has Category **Computer, H/W & S/W Supplies**, Category confirmed by your name, Approval status **Approved**, Approved by, Approved on, Quote files and Receipt files.
29. Choose **Mark processed** in the app.
30. **Return at approval (optional, 5 minutes).** Make another request like step 21 to 23 (you can use `harbor-software-quote.pdf`, Harbor Software, **870.00**). When it is Awaiting approval, open it under **Approvals**, choose **Return with a note**, type **Please add a second quote**, and choose **Return request**. As the employee, the banner on **My requests** says it was returned by the approver. Correct it and choose **Send for approval** again. The approver email subject should now say **round 2**. You do not need to approve this one.
31. **Needs attention.** In the app, open **Needs attention**. Nothing from steps 21 to 30 should be listed (a stuck approval email or package is listed there after 30 minutes).

## Part 7. Optional

32. **A purchase bought before approval (5 minutes).** New request, **Request details**: Department **Testing**, Business purpose **Checkpoint test, already bought**. On **Purchases** drop `blue-fern-web-invoice.pdf` as a receipt (it is dated 2026-09-18 and is $1,140.00). Check the row: vendor **Blue Fern Web Co.**, what **Website hosting for the year**, category **Advertising/Marketing/Website**, amount **1140.00**, who paid **Company**, and choose **Confirm** on the row. A vendor total of $500 or more needs a quote or a reason, so type **Already purchased** in the **No quote: say why** box. Choose **Next: Review**, then **Send for approval**. The dialog should show an amber note: **This looks already bought. It will be flagged Bought before approval. You can still send it.** Send it, approve it as in steps 25 and 26, then submit it as in step 27. The submission email and the CSV should carry the flag: in the email, a line starting **FLAG, bought before approval**; in the CSV, **Bought before approval** says **Yes**.
33. **A colleague (recommended).** Add them to the site (**Settings**, **Site permissions**, **Add members**, **Add users**, with **Edit**; they must not be an Owner, so if you made them one in step 3, move them to the **Members** group first). Ask them to open the **Purchase Requests** page.
    - They should see only **My requests** in the sidebar (no **Approvals**, **Requests to process**, **Needs attention**, **All requests** or **Set-up**).
    - They create a request and add a receipt. On **Request details**, note what the **Approver** line says: it should say **Site Owners (Your Name)**, or just **Site Owners**. Either is fine; tell me which. If it names you, a person who is not an Owner can read the Owners group, which settles an Unverified point (`docs/QUESTIONS_FOR_MAX.md` question 16).
    - They do **not** see your requests, and you see theirs under **All requests**. This confirms each employee sees only their own items, attachments included.
    - If they send a request over $500 for approval, the email goes to you, not to them, and they cannot approve it themselves: **Approvals** is not in their sidebar.
34. **A failed approval email (optional; skip it if it looks like more trouble than it is worth).** The failure paths are the part of the flow that has never run on a real site, in travel or here (**Check 4 (new)**). To see one: in Power Automate, open **Data**, then **Connections**, and remove the **Office 365 Outlook** connection used by the flow (the flow then shows a connection error). Send a new request over $500 for approval. Within 10 minutes, in the app the submission shows **Approval email failed**, and **Needs attention** lists it with the error. The flow's run history shows the **On approval failure** scope ran, and **Mark approval failed** succeeded. Then fix the connection (open the flow, choose **Edit**, and sign in to Outlook again), turn the flow on if it is off, and in the app choose **Retry approval email**. The email should now arrive. (You may get the approval email twice if a failure happened after sending; that is expected, FLOW.md.)

## What to send me

- Which steps worked, and the exact text or a screenshot of anything that did not. For the new checks, a line each: **Check 1** (imports and turns on), **Check 2** (the Yes branch is taken for an approval request and No for a submission), **Check 3** (the approval email arrives, and the link works), **Check 4** (the failure scope, if you did step 34), **Check 5** (the addresses on Set-up and in the flow's **Send approval email** step).
- If the flow failed: in Power Automate, open the flow, then the failed run, and screenshot the step shown in red.
- The answers to the five questions at the top of `docs/QUESTIONS_FOR_MAX.md`, if you have them. They do not block this checkpoint.

These checks settle the five new points in `flow/FLOW.md`, the Unverified items in `docs/QUESTIONS_FOR_MAX.md` question 16, and the Stage 4 notes in `docs/CHANGELOG.md`. Nothing needs cleaning up afterwards: the test site and test flow stay for testing in the security review and the pilot.
