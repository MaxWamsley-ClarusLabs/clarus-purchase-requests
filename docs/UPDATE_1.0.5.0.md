# Updating the Purchase Requests app to version 1.0.5.0 (the flows write to App Output)

For Max. About 45 minutes, in four parts. **No list changes and no Set-up "Update the lists" step**: nothing stored changes and the three lists are untouched. The two flow packages **must be made again and imported again**, because the destination is written into them. Do this instead of install step 8 of the earlier plan (the old flow replacement): turn off the old flow once, here.

## What is in 1.0.5.0 (P-064)

- **The Executive Team site is retired and gets nothing.** The flows write to the Forms and Apps site, in the **Documents** library, folder **App Output**: `Purchases_To_Process` (each request's `PR-####` folder), `Purchase_Receipts` (the receipt archive) and `Ledger_Backups` (the nightly backup). Folder names and file contents are unchanged.
- **You create and restrict the folders. Nothing in the app or the flows creates them or sets permissions.** Each flow checks its folder and stops with a clear message if it is missing. Set-up makes no package until the three folders exist.
- Where the flows write is held in **one place** in the app (`app/src/export/outputDestination.ts`), and the paths shown on screen read from it.
- Processed requests are filed by you in **Internal Records > Accounting and Receipts**. The app writes nothing there.
- **Which connection needs write access:** the SharePoint connection of the person who imports the flows (your account). Keep **Edit** on `App Output` and the three folders inside it.

## Before you start

1. If `Documents / App Output` already exists, write down the folders in it and who can open them. Nothing there is changed by this update.
2. Keep the file name exactly `clarus-purchase-requests.sppkg`.

## Part 1. The folders (about 10 minutes, your Microsoft 365 change)

On `https://claruslabsusa.sharepoint.com/sites/FormsandApps`, open **Documents**.

3. Check that the folder **App Output** exists, and inside it **Purchases_To_Process**, **Purchase_Receipts** and **Ledger_Backups**. The names must be exactly these. Create any that is missing. (The policy app says `Purchase_Receipts` and `Ledger_Backups` exist now; check them, and `Purchases_To_Process`, yourself.)
4. Restrict `App Output`: open its **Manage access**, choose **Advanced**, **Stop inheriting permissions**, and remove the groups that should not open it. **Keep your own account** (the one that will import the flows) with **Edit** or **Full control**, and keep **Purchase Bookkeepers** able to read `Purchase_Receipts` (so receipt links open for them).
5. To use the **Test** flow too, create `Purchases_Test` in Documents with the same three folders inside it (`Purchases_To_Process`, `Purchase_Receipts`, `Ledger_Backups`). The Test flow no longer creates them either.

## Part 2. The app (about 10 minutes)

6. Open `https://claruslabsusa-admin.sharepoint.com`, **More features**, **Apps**, **Open**, then **Upload** `clarus-purchase-requests.sppkg`, and **Replace it**. (If you have not installed 1.0.4.0, this package includes it: the Delete button on My requests and the status colors.)
7. In "Enable app" choose **Only enable this app**, then **Enable app**. The row must show **1.0.5.0**, **Enabled**, **Added to all sites: No**.
8. Open the Purchase Requests page and press **Ctrl+F5**. Open **Set-up** and choose **Check again**: all three lists show **Ready**. Do not run "Update the lists" unless it asks.
9. Open **All requests**: the same requests with the same statuses as before.

## Part 3. The Purchase Requests flow (about 15 minutes)

Two copies of the flow must never be on at the same time: both would try to package the same request.

10. In **Set-up**, under **2. Flow package**, choose **Live**. The page says the folders go to `App Output > Purchases_To_Process` on the Forms and Apps site. Choose **Download flow package**. If it says a folder was not found, create that folder (Part 1) and try again.
11. In Power Automate (`https://make.powerautomate.com`), open **My flows**. Open the existing Purchase Requests flow and choose **Turn off**. Do not delete it yet. If you have more than one, tell me the names before turning anything off.
12. Choose **Import**, **Import Package (Legacy)**, upload the new file, pick your own **SharePoint** and **Office 365 Outlook** connections, **Create as new**, **Import**. Open the new flow and **Turn on**.
13. Submit a small test request (or use a Test flow first, with the Test choice and `Purchases_Test`). Within about 10 minutes a `PR-####` folder should appear in `App Output / Purchases_To_Process`, its receipts in `App Output / Purchase_Receipts`, and the email arrives. Nothing should appear on the Executive Team site.
14. When it works, delete the old flow.

## Part 4. The backup flow (about 10 minutes)

15. In **Set-up**, under **3. Ledger backup flow**, choose **Download backup flow package** (same Live choice). Import it the same way, and **Turn on**.
16. Choose **Run**. Within a few minutes `App Output / Ledger_Backups` holds a new `Ledger_<date>_<time>.csv` and `.md`. If you turn off the old backup flow, delete it only after this works.

Then run `docs/CHECKPOINT.md` Part 11 (steps 61 to 64) on the Test flow when you can.

## Older requests

Requests packaged before this version, including PR-0006 to PR-0013, may have receipt links on the retired Executive Team site. Nothing was changed. To list them: **Site contents**, **Purchase Submissions**, and filter the **Receipt archive link** and **Folder link** columns for text containing `ExecutiveTeam`. Send me the list if you want help deciding what to do.

## If you need to go back

Upload the 1.0.4.0 package the same way, and turn the old flow back on. The old flow would write to the Executive Team site again, so do this only briefly.
