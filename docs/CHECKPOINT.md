# Checkpoint: first install on a test site

**For:** Max. **When:** whenever you are ready; nothing else waits on it except testing in SharePoint. **Time:** about 75 minutes in total (my estimate), plus short waits for the flow to run.

This is your one hands-on checkpoint before the pilot (stage 11 of the stage plan, `docs/STRATEGY.md` section 14; it follows travel D-014, which carries over). It installs the app on a new **test** site and imports a **test** flow. Test request folders go to the test site's own Documents library, not the Accounting folder (P-008). The Travel Expense app, the current Power Apps apps and their lists, the Accounting folder and QuickBooks are not touched. The test site is separate from the Forms and Apps site; the real site is chosen later.

Microsoft's screens change often, and I cannot see them from here, so a button may be worded slightly differently. If a step does not match what you see, stop and tell me what the screen shows.

**How the steps are grouped.** Parts 1 to 4 install everything (steps 1 to 15). Part 5 tries a small request that needs no approval. Part 6 tries the approval path, which is the new part of the flow, so those steps are the ones to watch closely (steps 21 to 31). Part 7 is optional: a purchase bought before approval and a colleague (steps 32 and 33), then a note on the one new path this checkpoint does not test (step 34).

---

## Part 1. Create the test site

1. Go to `https://claruslabsusa.sharepoint.com` and choose **+ Create site**.
2. Choose **Communication site**, then the **Standard** or **Blank** design.
   - Recommended: a communication site creates no Microsoft 365 group or Teams team; people are added under Site permissions. A team site also works, but on a team site with a Microsoft 365 group the Owners may be stored as that group rather than as people, and then the approval email would go only to you (Unverified, `flow/FLOW.md`).
3. Site name: **Purchase Requests Test**. Keep the suggested address (`/sites/PurchaseRequestsTest`). Choose **Create site** (or **Finish**).
   - **Optional, and the only way to test one approval email to several people (Check 3).** Add a colleague as a second owner now: **Settings**, **Site permissions**, **Add members**, **Add users**, and put them in the **Owners** group. The approval email in Part 6 should then go to both of you. If you skip this, that part of Check 3 stays Unverified.
   - The flow package you make in step 12 keeps the approvers' addresses it was made with. A colleague you make an Owner here keeps getting the test flow's approval emails even after you move them to **Members**, until a new package is made and imported. So for step 33 (a colleague who is not an Owner), use a different colleague, or skip the last check there.

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
    - If a list shows **Permissions not set**, follow the steps in the red box on the page, then choose **Update the lists** (the red box ends "Check again here", but the button is labelled **Update the lists**).
    - If a list shows **Address in use**, tell me which one. It means a list with that address already exists on the site, which should not happen on a new site.

## Part 4. Import the test flow

12. Still on **Set-up**, under **2. Flow package**, keep **Test** selected and choose **Download flow package**. You get `PurchaseRequests_Flow_Test.zip`.
13. A green box appears under the button. Read it, and write down (or screenshot) what it says after "Approval emails go to".
    - **Check 5 (new).** It should say **the site Owners:** and then list your address, and your colleague's if you added one in step 3. If instead it says **your own address, because the site Owners could not be read**, tell me: that is the fallback, used when the Set-up page cannot read the Owners group or finds no usable address in it.
    - The box also shows where test folders go: `.../sites/PurchaseRequestsTest/Shared Documents/Purchases_Test/Purchases_To_Process`, which is this site's **Documents** library.
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
    - The **Vendor totals** table under the grid should show both vendors under $500, with **Not needed** under Approval.
18. Choose **Next: Review**. The **Approval** card should say **No approval needed**, the button at the top should say **Submit request** (not **Send for approval**), and nothing should be in red. Choose **Submit request**, tick the certification, and choose **Submit request** again.
19. Within about 5 to 10 minutes (the flow checks every few minutes):
    - an email **Purchase request submitted: ...** arrives, with the certification sentence in it;
    - the test site's **Documents** library has **Purchases_Test**, then **Purchases_To_Process**, then the request's folder, named like `2026-10-07_Your-Name_Checkpoint-test-small-purchase_PR-0001`, holding a receipt copy for each file (`R01_...` and `R02_...`, named after your two files) and `PR-0001_Purchases.csv` (the date and the number may differ);
    - in the app, **Requests to process** shows the request as **Packaged**.
    - **The folder path the app shows.** The app always says **Accounting > Purchases > Purchases_To_Process** (on **Requests to process** and on the request page), even on this test site. With the test package the folders are really where the green box in step 13 said: this test site's **Documents** library, in **Purchases_Test > Purchases_To_Process**. Nothing is written to Accounting. Where the app tells you to move a processed folder into **Accounting > Purchases > <year>**, do not do that at this checkpoint: leave test folders where they are.
    - **Check 2 (new), the No half.** In Power Automate, open **Purchase Requests flow (test site)**, then its run history, then the run for this submission (the latest). The step **If this is an approval request** should have taken the **No** (false) branch: a green tick on **Package**, and the approval steps skipped. If it took the approval branch, take a screenshot of the run.
    - Open the CSV. It should have one header row and two purchase rows, with 28 columns. For each row, check Category, **Suggested QuickBooks account (Unverified, to confirm with Max)** (the suggestions are my guesses, to confirm with you in `docs/QUESTIONS_FOR_MAX.md` question 1; for the categories in step 17 they are **Office Supplies** and **Shipping and Postage**), Amount, Who paid, Reimbursable, and that Approval status says **Not required**.
20. In the app, open the request under **Requests to process** and choose **Return with a note**. Type a note, for example **Checkpoint return** (**Return request** stays greyed out until there is a note), and choose **Return request**.
    - The dialog also says: "After returning, delete this request's folder from Purchases_To_Process. The corrected request arrives as a new folder ending in _R2." Do that here, on the test site only: in this site's **Documents** library, open **Purchases_Test**, then **Purchases_To_Process**, and delete the folder from step 19 (nothing in Accounting).
    - As the employee, correct it and submit it again: **My requests**, the **Correct it** button on the banner, then **Review and submit** and **Submit request** with the certification (you do not need to change anything). A new folder ending in `_R2` should appear, holding `PR-0001_R2_Purchases.csv`. Then choose **Mark processed** on the request.

## Part 6. Try the approval path (the new part of the flow)

Unless you added a second owner in step 3, you are the only Owner of the site, so you will be both the employee and the approver. The app records this as **self-approved** (P-020). The approval email goes to the addresses fixed in the package in step 12, the ones the green box listed in step 13: you, and your colleague if you added one.

21. **My requests**, then **New request**. Department **Testing**, Business purpose **Checkpoint test, approval**. Choose **Next: Purchases**.
22. Drop `acme-lab-supply-quote.pdf` into the box with the switch on **Quotes** (the box should not try to read it). The row shows $0.00 or an empty amount; type these values: date today, vendor **Acme Lab Supply**, what **Pipette tips and centrifuge tubes for the assay**, category **R&D Materials & Supplies / Equipment**, amount **640.00**, who paid **Company**.
    - The **Vendor totals** table should show Acme Lab Supply, $640.00, **Needed** under Approval and **Attached** under Quote.
    - Optional: remove the quote (the row menu, the three dots, then **Remove acme-lab-supply-quote.pdf**). The **No quote: say why** box should appear on the row, and the **Vendor totals** table should show **Missing** under Quote. On **Next: Review**, the problem is listed under **Before you send**, and **Send for approval** stays greyed out until you attach a quote or type a reason. Then attach the quote again (row menu, **Attach a quote**) before you go on, because step 28 expects it, and leave the reason empty.
23. Choose **Next: Review**. The **Approval** card says what needs approval, and the button at the top says **Send for approval**. Choose it. The dialog lists **Acme Lab Supply $640.00** and has no certification tick box. Choose **Send for approval**.
    - Sending clears the **Approved by** column and the return stage (the first time the app asks SharePoint to clear a person and a choice column; the Stage 4 notes in `docs/CHANGELOG.md` list this as Unverified). If you see an error message here, take a screenshot of it.
    - The request is now **Awaiting approval**, locked.
24. Within about 5 to 10 minutes:
    - **Check 2 (new), the Yes half.** In Power Automate, open **Purchase Requests flow (test site)**, then its run history, then the latest run. The step **If this is an approval request** should have taken the **Yes** (true) branch: a green tick on **Approval email**, and the packaging steps skipped. If it took the packaging branch, the flow read the type wrongly; take a screenshot of the run.
    - **Check 5 (continued).** In the same run, open the step **Send approval email**: its **To** should list the same addresses as the green box in step 13.
    - **Check 3 (new).** An email **Purchase approval needed: Your Name, Checkpoint test, approval (PR-0002)** arrives for each Owner address. It should list the requester, department, business purpose, the **Acme Lab Supply $640.00** total with its quote status, and the line "Open the request in Purchase Requests to approve it, confirm the categories, or return it with a note:" with a link. The link opens the request in the app. If you added a second owner in step 3, check that they got it too: that is the only test of one email to several addresses. If you did not, that part stays Unverified.
    - In the app, **Approvals** shows the request, and the request page shows **Approver emailed**.
25. In the app, choose **Approvals**, open the request, and look at the **Approval email** tab. It should read the same as the email you received. Open the **Purchases** tab: the category should be a drop-down. Change the category to **Computer, H/W & S/W Supplies** to see that a change is recorded.
26. Choose **Approve**. The dialog says **You changed 1 category.** and takes an optional note. Type **Checkpoint note** and choose **Approve request**. The request is **Approved**.
    - **My requests** shows a green banner: **PR-0002 Checkpoint test, approval is approved.** Buy, attach your receipts and submit it. It does not say who approved.
    - Choose **Open** on that banner. The request page's green banner says who approved: **Approved by Your Name (self-approved) on <date and time>.** Note: Checkpoint note.
27. As the employee, open the request again. It is editable, and each row now asks for a receipt. On the Acme Lab Supply row, open the row menu (the three dots), choose **Attach a receipt or invoice**, and pick `acme-lab-supply-invoice.pdf`. Then go to **Review and submit**. The button now says **Submit request**. Submit it with the certification.
28. Within about 5 to 10 minutes:
    - the email **Purchase request submitted: ...** arrives. It should include a line like **Approval: approved by Your Name (self-approved) on <date and time>. Note: Checkpoint note**;
    - the request folder (named for the purchase date, with `_PR-0002`) holds `R01_acme-lab-supply-invoice.pdf`, `Q01_acme-lab-supply-quote.pdf` and `PR-0002_Purchases.csv`;
    - in the CSV, the row has Category **Computer, H/W & S/W Supplies**, Category confirmed by your name, **Suggested QuickBooks account (Unverified, to confirm with Max)** saying **Computer and Software** (a guess, to confirm with you), Approval status **Approved**, Approved by, Approved on, Quote files and Receipt files.
29. Choose **Mark processed** in the app.
30. **Return at approval (optional, 5 minutes).** Make another request like step 21 to 23 (you can use `harbor-software-quote.pdf`, Harbor Software, **870.00**). When it is Awaiting approval, open it under **Approvals**, choose **Return with a note**, type **Please add a second quote** (**Return request** stays greyed out until there is a note), and choose **Return request**. As the employee, the banner on **My requests** says it **was returned to you by the approver**, with your note. Choose **Correct it**, then on **Review and submit** choose **Send for approval** again. The approver email subject should now say **round 2**. You do not need to approve this one.
31. **Needs attention.** In the app, open **Needs attention**. Nothing from steps 21 to 30 should be listed (a stuck approval email or package is listed there after 30 minutes).

## Part 7. Optional

32. **A purchase bought before approval (5 minutes).** New request, **Request details**: Department **Testing**, Business purpose **Checkpoint test, already bought**. On **Purchases** drop `blue-fern-web-invoice.pdf` as a receipt (it is dated 2026-09-18 and is $1,140.00). Check the row: vendor **Blue Fern Web Co.**, what **Website hosting for the year**, category **Advertising/Marketing/Website**, amount **1140.00**, who paid **Company**, and choose **Confirm** on the row. A vendor total of $500 or more needs a quote or a reason, so type **Already purchased** in the **No quote: say why** box. Choose **Next: Review**, then **Send for approval**. The dialog should show an amber note: **This looks already bought. It will be flagged Bought before approval. You can still send it.** Send it, approve it as in steps 25 and 26, then submit it as in step 27. The submission email and the CSV should carry the flag: in the email, a line starting **FLAG, bought before approval**; in the CSV, **Bought before approval** says **Yes**.
33. **A colleague (recommended).** Add them to the site (**Settings**, **Site permissions**, **Add members**, **Add users**, with **Edit**). They must not be an Owner. Best is a colleague who was not an Owner when you made the package in step 12. If you use the colleague you made an Owner in step 3, move them to the **Members** group first and skip the last check below: the package still has their address, so they still get approval emails. Ask them to open the **Purchase Requests** page.
    - They should see only **My requests** in the sidebar (no **Approvals**, **Requests to process**, **Needs attention**, **All requests** or **Set-up**).
    - They create a request and add a receipt. On **Request details**, note what the **Approver** line says: it should say **Site Owners (Your Name)**, or just **Site Owners**. Either is fine; tell me which. If it names you, a person who is not an Owner can read the Owners group, which settles an Unverified point (`docs/QUESTIONS_FOR_MAX.md` question 23).
    - They do **not** see your requests, and you see theirs under **All requests**. This confirms each employee sees only their own items, attachments included.
    - If they send a request over $500 for approval, the approval email goes to the addresses listed in step 13, not to them, and they cannot approve it themselves: **Approvals** is not in their sidebar.
34. **A failed approval email (Check 4): not tested at this checkpoint. Nothing to do here.** The failure path (the **On approval failure** scope) has never run on a real site, in travel or here. The only ways to make it run on purpose are to break a connection that other flows share, such as your **Office 365 Outlook** connection, which the travel flow and your other flows also use (and repairing the flow afterwards would mean editing it by hand, which `flow/FLOW.md` and travel D-068 rule out), or to change list data by hand. So do not delete, remove or change any connection. Check 4 stays Unverified in `flow/FLOW.md` until a real failure happens. If an approval email ever fails in real use, the app lists it under **Needs attention** as **Approval email failed**, with the error; choosing that row opens the request page, which has a **Retry approval email** button.

## What to send me

- Which steps worked, and the exact text or a screenshot of anything that did not. For the new checks, a line each: **Check 1** (imports and turns on, steps 14 and 15), **Check 2** (No for the submission in step 19, Yes for the approval request in step 24), **Check 3** (the approval email arrives and the link works; and whether your second owner got it, if you added one in step 3), **Check 5** (what the green box said after "Approval emails go to" in step 13, and the **To** of **Send approval email** in step 24). **Check 4** is not tested at this checkpoint (step 34), so there is nothing to send for it.
- If the flow failed: in Power Automate, open the flow, then the failed run, and screenshot the step shown in red.
- The answers to the five questions at the top of `docs/QUESTIONS_FOR_MAX.md`, if you have them. They do not block this checkpoint.

These checks settle points 1, 2 and 5 of the new points in `flow/FLOW.md`, and point 3 for one address (for several addresses only if you added a second owner in step 3). Point 4, the failure scope, stays Unverified. They also settle the Unverified items in `docs/QUESTIONS_FOR_MAX.md` question 23 other than the failure scope, and the Stage 4 notes in `docs/CHANGELOG.md`. Nothing needs cleaning up afterwards: the test site and test flow stay for testing in the security review and the pilot.
