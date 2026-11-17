# Updating the Purchase Requests app to version 1.0.2.0

For Max. About 20 minutes. Nothing already stored is deleted at any step: the requests live in the SharePoint lists on the site, not in the app, and the Set-up step only adds two columns. Microsoft screen wording below is Unverified (Microsoft's documentation cannot be read from the build environment); if a screen differs, stop and send a screenshot.

## What is in 1.0.2.0

- A visible **+ Receipt** or **+ Quote** button in each row's Files cell.
- **Qty** and **Total** columns.
- **Shipping** and **Tax** boxes per vendor while buying.
- One receipt covers all of a vendor's rows.
- **Unsend** a request that is waiting for approval.
- **Record a purchase** for administrators, with no approval and no certification.

## Before you start

1. Pick a quiet time. From step 4 until step 7 is finished, employees see "Purchase Requests is not set up on this site yet."
2. Open **All requests** and write down how many requests you have and the status of two or three of them.
3. Keep the file name exactly `clarus-purchase-requests.sppkg`.

## Steps

4. Open `https://claruslabsusa-admin.sharepoint.com`, choose **More features**, then under **Apps** choose **Open** (**Manage apps**).
5. Choose **Upload** and select `clarus-purchase-requests.sppkg`. If SharePoint says the app already exists, choose **Replace it**. If it adds a second "Clarus Purchase Requests", stop and do not enable it.
6. Choose **Only enable this app**, then **Enable**. Check that it shows version **1.0.2.0**.
7. Open `https://claruslabsusa.sharepoint.com/sites/FormsandApps`, then the **Purchase Requests** page, and press **Ctrl+F5**. You do not need to edit or republish the page. You land on **Set-up**: choose **Update the lists** and wait until all three show **Ready** (about a minute). This adds only the **Quantity** and **Row type** columns.
   - If a list shows **Permissions not set**, follow the red box. If it shows **Address in use**, stop and tell Claude.
8. Open **All requests**. The same requests with the same statuses as in step 2 must be there. If anything differs, stop, delete nothing and send a screenshot.
9. If **Site contents** shows an update offered on the Clarus Purchase Requests tile, apply it. If nothing is offered, carry on.
10. Run Part 9 of `docs/CHECKPOINT.md` (steps 41 to 46) on the Test flow: unsend, record a purchase, quantity, one receipt per vendor.

## If you need to go back

Upload the previous package (version 1.0.1.0, or 1.0.0.0) the same way. The two new columns can stay: the old app ignores them. Your requests are untouched either way. Whether SharePoint accepts a lower version number is Unverified.

## Not changed

The Power Automate flow, the lists' permissions and the Accounting folders are not touched. You do not import a new flow package.
