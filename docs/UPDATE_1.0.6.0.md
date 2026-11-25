# Updating the Purchase Requests app to version 1.0.6.0 (the filing reminder)

For Max. **Use this package instead of 1.0.5.0.** Version 1.0.6.0 contains everything in 1.0.5.0 (the flows write to `App Output`, P-064) and 1.0.4.0 (Delete on My requests, the status colors), plus the filing reminder. **The steps are the same as `docs/UPDATE_1.0.5.0.md`** (the folders, the app, the two flow packages, turning off the old flow once, the test), with two additions below. No list changes and no "Update the lists" step.

## What is new in 1.0.6.0 (P-065)

- The **submission email** has a line **When processed, move it to:** with a link to `Accounting <year> / Purchase Requests` in Internal Records, beside the folder link.
- The **request page**'s purple box shows the **folder to move** and **where to move it** as links.
- Choosing **Mark processed** first opens a box with both links and a reminder that moving between the sites is a copy (check the copy, then delete the original). **Cancel** leaves the request as it was.
- The year is the year of the earliest purchase (the first four characters of the folder name). If the folder name does not start with a year, the link opens `Accounting and Receipts`.
- The app moves nothing and writes nothing in Internal Records. You file the folder by hand.

## Two additions to the UPDATE_1.0.5.0 steps

A. **Before the app part (UPDATE_1.0.5.0 Part 2), create the filing folders in Internal Records** (your OneDrive library, `Clarus Labs - Internal Records / Accounting and Receipts`). Nothing in the app creates them:
   1. Open `Accounting 2026`. If it is not there, create it. (It probably exists for travel reports.)
   2. Inside it, create a folder named exactly **Purchase Requests**.
   3. Before January 2027, do the same for `Accounting 2027`, and then once each year.

B. **After the flow packages are imported (UPDATE_1.0.5.0 Part 3), run `docs/CHECKPOINT.md` Part 12** (steps 65 to 68) on the Test flow: check the email's filing line, the request page and the Mark processed box.

## Unverified

- The flow works out the year with `isInt(substring(...))`. Step 65 checks it on the Test flow.
- The link opens Internal Records only for people who can open `Accounting and Receipts` there. You said the person who processes has access.

## The way back

Re-upload the earlier package and import the earlier flow packages. Nothing stored changes in this version.
