# The packaging flow

**Status:** Built at Stage 8 (2026-09-24). Test package imported and run successfully on the test site at the Stage 8 checkpoint (2026-09-28). Live package not yet imported. The design is strategy section 7; the code that writes the flow is `app/src/export/flowPackage.ts`. An example of the generated definition, with made-up IDs, is `flow/example/definition.json` (`npm run flow-example` rewrites it; a test fails if it is out of date).

## How Max gets it

The app's Set-up page, step 2 (D-047), reads the travel site's details and downloads `TravelExpenses_Flow_Test.zip` or `TravelExpenses_Flow_Live.zip`. Max imports it in Power Automate: My flows, Import, Import Package (Legacy); picks his own SharePoint and Office 365 Outlook connections; imports; turns the flow on. The package holds no password, key or connection: the connections are Max's, chosen at import.

| Package | Report folders go to | Use |
|---|---|---|
| Test | The test site's Documents library, `Trips_Test/Trips_To_Process` | Stage 8 checkpoint and Stage 13 testing. Nothing touches the Accounting folder |
| Live | ExecutiveTeam, Documents, `01_Company Documents/Accounting/Trips/Trips_To_Process` | Pilot and production (Stage 14 on). The Set-up page first checks, read-only, that `01_Company Documents/Accounting` exists |

The destination is fixed in the package. Nothing stored in a list can change where files go.

## What the flow does

| Step | Name in the flow | What it does |
|---|---|---|
| Start | When a submission is ready | Checks the Travel Submissions list (D-077) about every 5 minutes. Runs only for items whose Package status is Ready, one at a time |
| 1 | Claim the submission | Sets Package status to Processing, so the same submission is never packaged twice |
| 2 | Cleaned folder name, Safe folder name | Takes the folder name the app wrote and replaces `" * : < > ? / \ \| # % ~ & { } '`, `..`, tabs and line breaks with `-`; trims it; limits it to 120 characters; uses `Submission-<ID>` if nothing is left |
| 3 | Get attachments | Lists the files attached to the submission (the receipt copies and the CSV file) |
| 4 | Check folder 1 and 2, create if missing | On the first run only, creates `Trips` then `Trips_To_Process` (Test: `Trips_Test`, then `Trips_To_Process`). Never creates year folders (D-009) |
| 5 | Check report folder | Looks for a folder with the same name in `Trips_To_Process` |
| 6a | If the report folder is new and there are files | Creates the report folder; copies each attachment into it, one at a time, under its own name; sets Package status to Packaged with the folder link and time; emails the notification |
| 6b | Otherwise | Copies nothing, sets Package status to Failed with the reason ("a folder with this name already exists" or "no files"), and emails Max |
| On failure | On failure | If any step fails: sets Package status to Failed with the error, and emails Max a link to the flow run and to Needs attention |

**Email (D-046, D-067).** To Max. The subject is the one the app wrote. The body is a fixed heading, the summary the app wrote, and links to the folder, `Trips_To_Process` and the report in the app. The summary is stored as plain text, and the flow escapes it (`&`, `<`, `>`, `"`) before sending, so nothing an employee could type or edit is ever sent as HTML.

**Never overwritten, moved or deleted.** The flow only creates folders and files. It stops if the report folder already exists. After a failure part-way, Max deletes the partial folder, then chooses Retry packaging in the app (SOP Part B5).

## Actions used

All standard connectors (strategy section 9): SharePoint and Office 365 Outlook, both on Max's account.

| Action | Used for | Format source |
|---|---|---|
| SharePoint: When an item is created or modified (GetOnUpdatedItems) | Start | Connector reference; sample packages use the older format of the same trigger |
| SharePoint: Update item (PatchItem) | Status, link, time, error | Sample packages |
| SharePoint: Get attachments (GetItemAttachments) | List the files | Connector reference |
| SharePoint: Get attachment content (GetAttachmentContent) | Read each file | Connector reference |
| SharePoint: Send an HTTP request to SharePoint (HttpRequest) | Check whether a folder exists; create folders | Sample packages |
| SharePoint: Create file (CreateFile) | Copy each file into the report folder | Connector reference, plus Claude's knowledge of the "body" parameter name |
| Office 365 Outlook: Send an email (V2) (SendEmailV2) | Emails to Max | Sample packages |

Sources: pnp/powerautomate-samples on GitHub (commit c704efd, 2026-01-19) and Microsoft's connector reference in microsoft/skills-for-copilot-studio (commit fd9653d, 2026-09-09), both read on 2026-09-24.

## Points to confirm at the Stage 8 checkpoint

**Result, 2026-09-28 (Max, test site):** all six confirmed by a successful run. Max imported and turned on the Test package; a submitted report produced the notification email and a report folder holding the receipt copy and the CSV. Point 5 is confirmed because the notification email is sent only after the Update item step succeeds (step 6a). Point 6: the trigger ran on Max's licence.

1. The package imports with Import Package (Legacy), and the import screen accepts the real list ID without asking again.
2. Create file takes the file content as `body` (the connector reference calls it "file").
3. Get attachments returns `Id` and `DisplayName` for each file, as the reference says.
4. SharePoint answers "does this folder exist" with Exists = false for a missing folder, rather than an error.
5. Update item sets the Package status choice through `item/PackageStatus/Value`, and does not need the Title column.
6. The trigger's 5-minute check is allowed on Max's licence.

If any fails, the fix goes into `flowPackage.ts` and a new package is made from the Set-up page; the flow is never edited by hand, so this file and the code stay true.
