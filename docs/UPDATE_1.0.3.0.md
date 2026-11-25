# Updating the Purchase Requests app to version 1.0.3.0 (the Ledger)

*Note 2026-11-25: version 1.0.5.0 moves where the flows write (P-064): the Live folders are now in `App Output` on the Forms and Apps site, which you create first, and the flows no longer create folders. Where Part 2, Part 3 and Part 4 below name `Accounting/Purchases` or say a folder is created on the first run, follow `docs/UPDATE_1.0.5.0.md` instead.*

For Max. About 60 to 90 minutes, in four parts. Nothing already stored is deleted at any step: the requests live in the SharePoint lists, not in the app, and the Set-up step only **adds** columns (seven on the lines list, one on the submissions list). Microsoft screen wording below is Unverified (Microsoft's documentation cannot be read from the build environment); if a screen differs, stop and send a screenshot.

Do all of it on the **Test** flow first (`docs/CHECKPOINT.md` Part 10), then the Live flow.

## What is in 1.0.3.0

- A **Ledger** page for administrators and a new SharePoint group, **Purchase Bookkeepers**: every bought line with a QuickBooks account, a class and **Posted**, type-ahead dropdowns with the likeliest choices on top, and **Download Excel**.
- Bookkeeper helpers: a **note** on each line, a warning when a posted line **changed afterwards**, **Apply to selected** (one account and class for many lines), **Show only** and **Sort by**, an **Administrator decides** marker, and a count of lines still to post beside Ledger in the sidebar.
- The category dropdown shows the QuickBooks account number with the name.
- The Purchase Requests flow also copies each request's **receipts** into a permanent archive, `Purchase_Receipts`, so receipt links keep working after you file the request folder.
- A second flow, the **nightly ledger backup**: a new dated CSV and Markdown copy of the ledger every night in `Ledger_Backups`.

## Before you start

1. Pick a quiet time. From part 1 step 4 until step 7 is finished, employees see "Purchase Requests is not set up on this site yet."
2. Open **All requests** and write down how many requests you have and the status of two or three of them.
3. Keep the file name exactly `clarus-purchase-requests.sppkg`.

## Part 1. The app and the lists (about 20 minutes)

4. Open `https://claruslabsusa-admin.sharepoint.com`, choose **More features**, then under **Apps** choose **Open** (**Manage apps**).
5. Choose **Upload** and select `clarus-purchase-requests.sppkg`. If SharePoint says the app already exists, choose **Replace it**. If it adds a second "Clarus Purchase Requests", stop and do not enable it.
6. Choose **Only enable this app**, then **Enable**. Check that it shows version **1.0.3.0**.
7. Open `https://claruslabsusa.sharepoint.com/sites/FormsandApps`, then the **Purchase Requests** page, and press **Ctrl+F5**. You land on **Set-up**: choose **Update the lists** and wait until all three show **Ready**. This adds only the columns **Ledger account**, **Ledger class**, **Posted**, **Posted by** and **Posted on** (lines list) and **Receipt archive link** (submissions list).
   - If a list shows **Permissions not set**, follow the red box. If it shows **Address in use**, stop and tell Claude.
8. Open **All requests**. The same requests with the same statuses as in "Before you start" step 2 must be there. If anything differs, stop, delete nothing and send a screenshot.
9. Open any request as an employee would and look at the category dropdown: each category now starts with its QuickBooks number, for example **6182 R&D Materials & Supplies**.

## Part 2. The receipt archive: replace the Purchase Requests flow (about 15 minutes)

The new package replaces the old flow. **Two copies of the flow must never be on at the same time**: both would try to package the same request and one would fail.

10. In **Set-up**, under **2. Flow package**, choose **Test** (or **Live** when you do the Live flow), then **Download flow package**.
11. In Power Automate, open **My flows**. Open the existing Purchase Requests flow (Test: "Purchase Requests flow (test site)") and choose **Turn off**.
12. Choose **Import**, then **Import Package (Legacy)**, upload the new file, and for **SharePoint** and **Office 365 Outlook** choose **Select during import** and pick your own account. Under **Import setup** for the flow choose **Create as new** (not Update, so the old one stays until the new one is proven), then **Import**.
13. Open the new flow and **Turn on**. Keep the old one off.
14. Test it (`docs/CHECKPOINT.md` steps 48 to 50). When the receipt archive works, delete the old flow.

The archive folder, `Purchase_Receipts`, is created on the first packaged request, next to `Purchases_To_Process` (Test: `Purchases_Test/Purchase_Receipts`). Nothing existing in the Accounting folder is changed.

## Part 3. The nightly backup flow (about 10 minutes)

15. In **Set-up**, under **3. Ledger backup flow**, choose **Download backup flow package** (it uses the same Test or Live choice).
16. In Power Automate choose **Import**, **Import Package (Legacy)**, upload it, pick your own account for **SharePoint** and **Office 365 Outlook**, choose **Import**, then open the flow and **Turn on**.
17. To see it work now, open the flow and choose **Run**. Within a few minutes the folder `Ledger_Backups` (next to `Purchases_To_Process`) holds a `Ledger_<date>_<time>.csv` and a `.md`. Open both: they list the bought lines with the account, class and Posted columns (empty at first). Running it again makes a new pair; the first pair is not replaced.

## Part 4. Bookkeepers (about 15 minutes, your Microsoft 365 change)

18. On the Forms and Apps site choose the gear, then **Site permissions**, then **Advanced permissions settings**. Choose **Create Group**. Name it exactly **Purchase Bookkeepers**. Under **Give Group Permission to this Site** choose **View Only** (it is changed per list below), then **Create**.
19. Open the group and **Add** the bookkeepers (internal people with a Clarus account).
20. For each of the three lists (**Purchase Requests**, **Purchase Request Lines**, **Purchase Submissions**): open the list, choose the gear, **List settings**, **Permissions for this list**. If it says the list inherits permissions, choose **Stop Inheriting Permissions** (the app's own "own items only" settings stay as they are). Choose **Grant Permissions**, add **Purchase Bookkeepers**, give **Edit**, and **Share**.
   - **Why Edit:** a bookkeeper must read every employee's lines and change the Ledger columns. Edit does not let them approve requests (that needs the Owners' "Manage web site"). Unverified: that Edit lets them read other people's items despite "own items only". If the Ledger shows no lines for a bookkeeper, stop and tell Claude.
21. Give **Purchase Bookkeepers** **Read** access to `Accounting/Purchases/Purchase_Receipts` once it exists (after the first packaged request), so the receipt links open for them.
22. As a bookkeeper (or in a private window): open the **Purchase Requests** page. The sidebar shows **Bookkeeping, Ledger** and no Approvals. If it shows an empty or "not set up" page, check step 18's group name and step 20.

An outside bookkeeper (no Clarus account) needs a guest account in your Microsoft 365, which depends on the tenant's external-sharing settings (Unverified). It is not set up here. There is no separate username and password for the app.

## If you need to go back

Upload the previous package (version 1.0.2.0) the same way, turn the new flow off and the old one on, and turn the backup flow off. The new columns can stay: the old app ignores them. Your requests are untouched either way. Whether SharePoint accepts a lower version number is Unverified.

## Not changed

The approval and processing screens, the CSV in each request folder, the folders already in `Accounting` and the lists' "own items only" permissions are not touched. The Purchase Requests flow keeps doing what it did; it also copies the receipts into the archive.
