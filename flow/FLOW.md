# The Purchase Requests flow

**Status:** Built 2026-10-01; not yet imported anywhere. The design is strategy section 8 and P-018; the code that writes the flow is `app/src/export/flowPackage.ts`. An example of the generated definition, with made-up IDs, is `flow/example/definition.json` (`npm run flow-example` rewrites it; a test fails if it is out of date). The packaging branch is the travel flow's packaging steps, unchanged apart from names and wording; the travel flow was imported and run on a real test site on 2026-09-28 (travel `flow/FLOW.md`). The If action that chooses between the two branches, and the approval branch itself, are new and have not run anywhere.

One flow does both jobs (P-018). The app writes every approval request and every submission as an item in the Purchase Submissions list, first as Uploading and then as Ready. The flow starts on Ready, claims the item, and looks at its Type. An approval request only emails the approvers. A processing package is packaged exactly as in the travel flow.

## How Max gets it

The app's Set-up page, step 2 (travel D-047), reads the site's details and downloads `PurchaseRequests_Flow_Test.zip` or `PurchaseRequests_Flow_Live.zip`. Max imports it in Power Automate: My flows, Import, Import Package (Legacy); picks his own SharePoint and Office 365 Outlook connections; imports; turns the flow on. The package holds no password, key or connection: the connections are Max's, chosen at import.

| Package | Request folders go to | Use |
|---|---|---|
| Test | The test site's Documents library, `Purchases_Test/Purchases_To_Process` | The test-site checkpoint (`docs/CHECKPOINT.md`) and later testing. Nothing touches the Accounting folder |
| Live | ExecutiveTeam, Documents, `01_Company Documents/Accounting/Purchases/Purchases_To_Process` | Pilot and production. The Set-up page first checks, read-only, that `01_Company Documents/Accounting` exists |

The destination and the approvers' addresses are fixed in the package. Nothing stored in a list can change where files go or who is emailed (P-008, P-018).

The approvers are the site Owners' addresses as they are when the package is made. If Set-up cannot read the Owners, it uses the administrator's own address. To add an approver, add them as an Owner, make a new package on Set-up and import it again. Whether Import Package (Legacy) then offers to update the flow already there is Unverified (the package marks the flow as "Existing, New, Update", copied from the sample packages; not tried). If it only creates a new flow, turn the old one off so that nobody is emailed twice.

## What the flow does

| Step | Name in the flow | What it does |
|---|---|---|
| Start | When a submission is ready | Checks the Purchase Submissions list (P-007) about every 5 minutes. Runs only for items whose Package status is Ready, one at a time |
| 1 | Claim the submission | Sets Package status to Processing, so the same item is never handled twice |
| 2 | If this is an approval request | Reads the item's Type (a choice column, read through its Value). Approval request: the approval branch, steps A1 and A2. Anything else, an empty Type included: the packaging branch, steps P1 to P5 |
| A1 | Send approval email | Emails every approver in one message, from Max's account: the subject and summary the app wrote, and a link that opens the request in the app |
| A2 | Mark approval sent | Sets Package status to Packaged, with the time and no error. The app shows "Approver emailed" |
| A, on failure | On approval failure | If A1 or A2 fails: sets Package status to Failed with the error, and emails the administrator a link to the flow run and to Needs attention |
| P1 | Cleaned folder name, Safe folder name | Takes the folder name the app wrote and replaces `" * : < > ? / \ \| # % ~ & { } '`, `..`, tabs and line breaks with `-`; trims it; limits it to 120 characters; uses `Submission-<ID>` if nothing is left |
| P2 | Get attachments | Lists the files attached to the submission (the receipt copies, the quote copies and the CSV file) |
| P3 | Check folder 1 and 2, create if missing | On the first run only, creates `Purchases` then `Purchases_To_Process` (Test: `Purchases_Test`, then `Purchases_To_Process`). Never creates year folders (travel D-009) |
| P4 | Check report folder | Looks for a folder with the same name in `Purchases_To_Process` |
| P5a | If the report folder is new and there are files | Creates the request folder; copies each attachment into it, one at a time, under its own name; sets Package status to Packaged with the folder link and time; emails the administrator the submission email |
| P5b | Otherwise | Copies nothing, sets Package status to Failed with the reason ("a folder with this name already exists" or "no files"), and emails the administrator |
| P, on failure | On failure | If any packaging step fails: sets Package status to Failed with the error, and emails the administrator a link to the flow run and to Needs attention |

The packaging branch keeps the travel flow's action names, including the three that say "report" (`Check_report_folder`, `If_the_report_folder_is_new`, `Create_report_folder`). They mean the request folder. They are unchanged on purpose: the same actions ran on a real site, and a test checks that the list of names is the travel list.

The actions, by nesting level:

```
When_a_submission_is_ready              trigger: Package status is Ready, every 5 minutes, one run at a time
Claim_the_submission
If_this_is_an_approval_request          Type is Approval request?
  Yes
    Approval_email                      scope
      Send_approval_email
      Mark_approval_sent
    On_approval_failure                 scope, runs if Approval_email fails or times out
      Failed_approval_steps
      Mark_approval_failed
      Send_approval_failure_email
  No
    Package                             scope
      Cleaned_folder_name, Safe_folder_name, Get_attachments
      Check_folder_1, If_folder_1_is_missing (Create_folder_1)
      Check_folder_2, If_folder_2_is_missing (Create_folder_2)
      Check_report_folder
      If_the_report_folder_is_new
        Yes: Create_report_folder, Copy_files (Get_attachment_content, Create_file), Mark_packaged, Send_notification
        No:  Mark_not_packaged, Send_not_packaged_email
    On_failure                          scope, runs if Package fails or times out
      Failed_steps, Mark_failed, Send_failure_email
```

Every action name is unique across the whole definition, and every "run after" names an action in the same container; tests check both. The deepest actions, Get attachment content and Create file, are five levels down (travel: four).

**Emails (travel D-046 and D-067; P-018).** The subject and the summary are written by the app (`email.ts`) and stored as plain text in the submission item. The flow escapes the summary (`&`, `<`, `>`, `"`) and turns line breaks into HTML line breaks before sending, so nothing an employee could type or edit is ever sent as HTML. Only the subject is used as it is, because a subject is plain text. Recipients are never read from the item.

- **Approval email (A1).** To every approver, in one message. Subject: `Purchase approval needed: <name>, <purpose> (PR-0042)`, or `Purchase approval needed again: ... (PR-0042, round 2)`. Body: the heading "Purchase approval needed" (with "again" when the item's Submission number is more than 1), the summary, and the line "Open the request in Purchase Requests to approve it, confirm the categories, or return it with a note:" with a link to the request in the app.
- **Submission email (P5a).** To the administrator (today, Max). Subject: `Purchase request submitted: ...` or `Purchase request resubmitted: ...`, as the app wrote it. Body: the same words as a heading, the summary, and three links: the new request folder, "All requests waiting" (`Purchases_To_Process`) and "Open the request in Purchase Requests".
- **Failure emails (to the administrator).** `Purchase request not packaged: <label>` (P5b; the reason, and a link to Needs attention), `Purchase request packaging failed: <label>` (P, on failure; the error, a link to the flow run and a link to Needs attention) and `Purchase approval email failed: <label>` (A, on failure; the same). The label is the submission's Title, for example `PR-0042 approval 1`, or "a purchase request" if it is empty.

**Never overwritten, moved or deleted.** The flow only creates folders and files, and only in the packaging branch. It stops if the request folder already exists. After a failure part-way, Max deletes the partial folder, then chooses Retry packaging in the app (SOP Part B, Needs attention and failed packages). The approval branch creates no folder and no file: it sends one email and updates the submission item. If the email was sent but the status update then failed, the item shows Failed, and Retry approval email sends the email again, so the approvers can get it twice.

**An item an employee has edited.** Employees can edit their own submission items in SharePoint (travel D-002). Someone who changes an item's Type to Approval request can only make the flow email the approvers, at the addresses fixed in the package, with the item's text escaped; nothing is created in the destination. An item whose Type is empty or not "Approval request" is packaged, and stops with an error if it has no files.

## Actions used

All standard connectors (strategy section 9): SharePoint and Office 365 Outlook, both on Max's account.

| Action | Used for | Format source | Evidence |
|---|---|---|---|
| SharePoint: When an item is created or modified (GetOnUpdatedItems) | Start | Connector reference; sample packages use the older format of the same trigger | Verified in travel (ran, 2026-09-28) |
| SharePoint: Update item (PatchItem) | Claim; status, link, time, error; the approval's status | Sample packages | Verified in travel (ran) |
| SharePoint: Get attachments (GetItemAttachments) | List the files | Connector reference | Verified in travel (ran) |
| SharePoint: Get attachment content (GetAttachmentContent) | Read each file | Connector reference | Verified in travel (ran) |
| SharePoint: Send an HTTP request to SharePoint (HttpRequest) | Check whether a folder exists; create folders | Sample packages | Verified in travel (ran) |
| SharePoint: Create file (CreateFile) | Copy each file into the request folder | Connector reference, plus Claude's knowledge of the "body" parameter name | Verified in travel (ran) |
| Office 365 Outlook: Send an email (V2) (SendEmailV2) | The emails to the administrator (submission and failures) and the approval email to the approvers | Sample packages | Verified in travel for one recipient. **Unverified** for several recipients joined by `;` in the To line (Claude's knowledge of the connector; its documentation was not opened) |
| Control and data operations: Condition (If), Scope, Apply to each (Foreach), Compose | The branch, the scopes, the file loop, the folder name | Standard Power Automate and Logic Apps structure | Verified in travel for the packaging structure (ran). **Unverified** for the new If that holds the two scopes |
| Data operation: Filter array (Query), with the `result()` function | The list of failed steps, in the two failure scopes | Standard Logic Apps structure | **Unverified**: neither failure scope has run on a real site, in travel or here |

Sources: pnp/powerautomate-samples on GitHub (commit c704efd, 2026-01-19) and Microsoft's connector reference in microsoft/skills-for-copilot-studio (commit fd9653d, 2026-09-09), both read on 2026-09-24 for the travel flow. Microsoft's own documentation is blocked in this environment, so every platform claim in this file that is not marked Verified is Unverified.

## Points to confirm at the checkpoint

**Confirmed for the packaging branch (travel flow, a real test site, Max, 2026-09-28; travel `flow/FLOW.md`).** The same actions are in this flow's packaging branch, so the six points are listed as confirmed. They were not re-tested for this package. What ran in travel: a submitted report was packaged (notification email, report folder holding the receipt copy and the CSV), and a resubmission made its `_R2` folder. What did not run on a real site: the failure paths (On failure, and the stop when the folder already exists).

1. The package imports with Import Package (Legacy), and the import screen accepts the real list ID without asking again.
2. Create file takes the file content as `body` (the connector reference calls it "file").
3. Get attachments returns `Id` and `DisplayName` for each file, as the reference says.
4. SharePoint answers "does this folder exist" with Exists = false for a missing folder, rather than an error.
5. Update item sets the Package status choice through `item/PackageStatus/Value`, and does not need the Title column.
6. The trigger's 5-minute check is allowed on Max's licence.

**New, and Unverified until the test-site checkpoint.** Nothing here has run. Each point says what Max sees when it holds.

1. **The package with the nested If imports and turns on.** The new structure is one If action that holds both scopes, so the deepest action is five levels down, one more than in travel. The limit on nesting is believed to be 8 levels (Unverified: Claude's knowledge of the Power Automate limits; the page was not opened). Seen when: the import finishes without an error and the flow turns on.
2. **`SubmissionType` is read as `?['Value']` and the branch is taken for an approval request.** `PackageStatus` is read the same way in the trigger, and that works in travel; this is a second choice column read the same way. Seen when: the run history shows "If this is an approval request" with the answer Yes for an approval request, and No (the packaging branch runs) for a submission.
3. **The approval email arrives for each Owner address.** One message with all addresses in the To line, joined by `;` (Unverified for the connector, see Actions used). Seen when: every Owner receives "Purchase approval needed: ..." a few minutes after the request is sent for approval, with the escaped summary and a link that opens the request, and the app then shows "Approver emailed".
4. **A nested failure scope inside the branch reports a failure.** When the approval email cannot be sent, the scope On approval failure should run: Mark approval failed sets Package status to Failed with the error text (the app lists it under Needs attention), and Send approval failure email tells the administrator. The failure scope for packaging, On failure, has never run on a real site either. Seen when: a failed approval shows Failed with the error in the app, the run history shows the failure scope ran, and, if the Outlook connection can still send, "Purchase approval email failed: ..." arrives.
5. **The approver addresses are the site Owners read when the package was made.** Set-up reads them (`getFlowSettings`) and writes them into the package; they are not read again. Unverified that an administrator can read the Owners group (strategy section 17); if not, Set-up falls back to the administrator's own address. Seen when: the Send approval email step in the imported flow lists the Owners' addresses in its To field, and each of them receives the email.

If any fails, the fix goes into `flowPackage.ts` and a new package is made from the Set-up page; the flow is never edited by hand, so this file and the code stay true.
