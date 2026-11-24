# Updating the Purchase Requests app to version 1.0.4.0

For Max. About 10 minutes. Nothing stored changes: there are **no new columns and no Set-up step**, and the flows are not touched. Do it on the Forms and Apps site after 1.0.3.0.

## What is in 1.0.4.0

- **Delete on My requests.** Each draft row has a red **Delete** button at its end, with a confirmation. Only drafts, only your own. A deleted draft goes to the site's recycle bin.
- **A color for every status:** Draft light purple, Awaiting approval amber, **Approved blue**, **Submitted teal**, Purchased purple, **Returned orange**, Processed green. The approval and package badges keep their colors.
- The Instructions and SOP say so (My requests, "Starting a request").

## Steps

1. Open `https://claruslabsusa-admin.sharepoint.com`, choose **More features**, then under **Apps** choose **Open**.
2. Choose **Upload** and select `clarus-purchase-requests.sppkg` (keep that exact file name). If SharePoint says the app already exists, choose **Replace it**. If it adds a second "Clarus Purchase Requests", stop and tell Claude.
3. In the "Enable app" window choose **Only enable this app**, then **Enable app**. Do not choose "add it to all sites".
4. In the list, the **Clarus Purchase Requests** row must show version **1.0.4.0**, State **Enabled**, Added to all sites **No**.
5. Open the Forms and Apps site, then the **Purchase Requests** page, and press **Ctrl+F5**.
6. Open **My requests**. Check: each draft row shows **Delete**; other rows do not; **Approved** is blue and **Returned** orange; and the same requests with the same statuses are there as before.
7. Try it: choose **New request**, go back to **My requests**, choose **Delete** on that blank draft, and confirm. It disappears, and a toast says it was deleted.

## If you need to go back

Upload the 1.0.3.0 package again the same way. Nothing stored changes in either direction.
