# The Purchase Requests flow

**Status:** Built 2026-10-01, and revised the same day after two reviews: the generator now refuses settings it cannot use safely, and the approval branch's failure handling tells the administrator even when marking the item Failed fails or times out, and reads the error text the travel flow's way (see "The error text on a failure"). Not yet imported anywhere. The design is strategy section 8 and P-018; the code that writes the flow is `app/src/export/flowPackage.ts`. An example of the generated definition, with made-up IDs, is `flow/example/definition.json` (`npm run flow-example` rewrites it; a test fails if it is out of date). The packaging branch is the travel flow's packaging steps, unchanged apart from names and wording; the travel flow was imported and run on a real test site on 2026-09-28 (travel `flow/FLOW.md`). The If action that chooses between the two branches, and the approval branch itself, are new and have not run anywhere.

One flow does both jobs (P-018). The app writes every approval request and every submission as an item in the Purchase Submissions list, first as Uploading and then as Ready. The flow starts on Ready, claims the item, and looks at its Type. An approval request only emails the approvers. A processing package is packaged exactly as in the travel flow.

## How Max gets it

The app's Set-up page, step 2 (travel D-047), reads the site's details and downloads `PurchaseRequests_Flow_Test.zip` or `PurchaseRequests_Flow_Live.zip`. Max imports it in Power Automate: My flows, Import, Import Package (Legacy); picks his own SharePoint and Office 365 Outlook connections; imports; turns the flow on. The package holds no password, key or connection: the connections are Max's, chosen at import.

| Package | Request folders go to | Use |
|---|---|---|
| Test | The test site's Documents library, `Purchases_Test/Purchases_To_Process` | The test-site checkpoint (`docs/CHECKPOINT.md`) and later testing. Nothing touches the Accounting folder |
| Live | ExecutiveTeam, Documents, `01_Company Documents/Accounting/Purchases/Purchases_To_Process` | Pilot and production. The Set-up page first checks, read-only, that `01_Company Documents/Accounting` exists |

**Who checks that Accounting exists.** The flow does not check that `01_Company Documents/Accounting` exists. The Set-up page checks it, read-only, when it makes a live package (`getFlowSettings` in `app/src/data/sharepoint/SharePointDataService.ts`), and makes no package if it is missing. The flow itself only looks for `Purchases` and `Purchases_To_Process` and creates them if they are missing, with SharePoint's path-based create (`addUsingPath`). If Accounting were removed after the package was made, whether that create would also make Accounting or would fail is Unverified (Claude's knowledge; not tried, and not tried at the checkpoint, because the test package never touches Accounting).

The destination and the approvers' addresses are fixed in the package. Nothing stored in a list can change where files go or who is emailed (P-008, P-018).

**What the generator refuses.** `flowPackage.ts` checks everything it writes into the flow (`checkFlowConfig`) and makes no package if anything fails; the Set-up page then shows the reason. Tests: "the generator refuses settings it cannot use safely" in `flowPackage.test.ts`.

- **Email addresses.** The administrator's address and every approver address must each be one plain address: ASCII letters, digits and `. _ % + ' -` before the `@`, a domain with a dot, at most 254 characters. That rules out spaces, commas, semicolons, braces (so no `@{`), angle brackets, double quotes, backticks, backslashes and a leading `@`, so an address can never be read as an expression or as a second address. Blank or padded entries are refused, not tidied: Set-up filters the Owners' addresses first. At most 20 approver addresses; with none, the administrator's address is used, so there is always at least one recipient.
- **Web addresses.** The site address, the destination site address and the page address must be https, with no user name or password and no braces, quotes, backticks, backslashes, angle brackets, spaces or control characters. The two site addresses must have no `?` or `#`. The page address is cut to its origin and path (the Set-up page already passes only those, and the generator cuts it again): browsers leave braces in a query string as they are, so a Set-up page opened with an address like `...aspx?x=@{triggerBody()...}` could otherwise put an expression into the app links of the five emails (the approval and submission emails link to the request; the three failure emails link to Needs attention).
- **The list ID** must be a GUID, as SharePoint gives it.
- **The destination.** A Live package must have exactly the fixed destination: the ExecutiveTeam site, `Shared Documents`, and the two folders `01_Company Documents/Accounting/Purchases` and `.../Purchases/Purchases_To_Process`. A Test package must send folders to the same site as the list, in `Shared Documents`, in exactly `Purchases_Test` and `Purchases_Test/Purchases_To_Process`. Anything else, an empty folder list included, is refused.

The approvers are the site Owners' addresses as they are when the package is made. If Set-up cannot read the Owners, or none of them has an address it can use, it uses the administrator's own address. After downloading, the Set-up page says which addresses the approval email will go to, and whether they are the site Owners or the administrator's own address because the Owners could not be read. On a team site connected to a Microsoft 365 group, the Owners group may hold the Microsoft 365 group as a single entry rather than the people in it; Set-up reads only people, so the package would then go to the administrator's address (Unverified: Claude's knowledge of SharePoint; the checkpoint uses a communication site, which has no such group). To add an approver, add them as an Owner, make a new package on Set-up and import it again. Whether Import Package (Legacy) then offers to update the flow already there is Unverified (the package marks the flow as "Existing, New, Update", copied from the sample packages; not tried). If it only creates a new flow, turn the old one off so that nobody is emailed twice.

## What the flow does

| Step | Name in the flow | What it does |
|---|---|---|
| Start | When a submission is ready | Checks the Purchase Submissions list (P-007) about every 5 minutes. Runs only for items whose Package status is Ready, one at a time |
| 1 | Claim the submission | Sets Package status to Processing, so the same item is never handled twice |
| 2 | If this is an approval request | Reads the item's Type (a choice column, read through its Value). Approval request: the approval branch, steps A1 and A2. Anything else, an empty Type included: the packaging branch, steps P1 to P5 |
| A1 | Send approval email | Emails every approver in one message, from Max's account: the subject and summary the app wrote, and a link that opens the request in the app |
| A2 | Mark approval sent | Sets Package status to Packaged, with the time and no error. The app shows "Approver emailed" |
| A, on failure | On approval failure | If A1 or A2 fails or times out: sets Package status to Failed with the error, and emails the administrator a link to the flow run and to Needs attention. The email is sent even if setting Failed itself fails or times out |
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
- **Failure emails (to the administrator).** `Purchase request not packaged: <label>` (P5b; the reason, and a link to Needs attention), `Purchase request packaging failed: <label>` (P, on failure; "Packaging failed:" and the error, a link to the flow run and a link to Needs attention) and `Purchase approval email failed: <label>` (A, on failure; "Sending the approval email, or recording that it was sent, failed:" and the error, with the same two links). The approval failure email does not say the email was not sent, because A2 can fail after A1 sent it. The label is the submission's Title, for example `PR-0042 approval 1`, or "a purchase request" if it is empty.

**The error text on a failure.** Each failure scope lists the steps that failed (Filter array over `result()`) and stores the first one's error in the item's Error message, which the app shows under Needs attention. Both branches read it the same way, the travel flow's way: the step's `error.message`, or a fixed sentence ("Packaging stopped. See the flow run." in the packaging branch; "Sending the approval email, or recording that it was sent, failed. See the flow run." in the approval branch), and the approval failure email quotes the same text, escaped. Neither reads into the step's outputs (for example `outputs.body.message`): an output body can be plain text, and selecting a property of text makes the expression itself fail, even with `?[...]`, so the scope would stop before it marked the item Failed or emailed anyone, and the item would stay Processing. A first version of the approval branch did read into the outputs; it was changed back after review on 2026-10-01. That the error message is in `error.message` for these connectors, and the behaviour of property selection on text, are Unverified (Claude's knowledge of the `result()` output and of the expression language; the failure scopes have not run). In the approval branch, the email to the administrator runs after Mark approval failed has succeeded, failed or timed out; the packaging branch keeps the travel flow's "succeeded or failed", unchanged on purpose.

**Never overwritten, moved or deleted.** The flow only creates folders and files, and only in the packaging branch. It stops if the request folder already exists. After a failure part-way, Max deletes the partial folder, then chooses Retry packaging in the app (SOP Part B, Needs attention and failed packages). The approval branch creates no folder and no file: it sends one email and updates the submission item. If the email was sent but the status update then failed, the item shows Failed, and Retry approval email sends the email again, so the approvers can get it twice.

**An item an employee has created or edited (accepted risk, P-033).** Employees can create and edit their own items in the Purchase Submissions list directly in SharePoint, outside the app (travel D-002). So an employee can make the flow send an approval email to every Owner, from the administrator's mailbox (the flow sends with the administrator's Outlook connection), with a subject and a summary of their choosing, once for each item they set to Ready. What limits it: the recipients and the links in the email are fixed in the package; the summary is escaped, so the text cannot contain markup; the subject is plain text; and nothing is created in the destination for an approval request. The item records who created it. Recorded as an accepted risk, P-033 in `docs/DECISIONS.md`, to look at again at the security review. An item whose Type is empty or not "Approval request" is packaged as in travel, and stops with an error if it has no files.

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
| Data operation: Filter array (Query), with the `result()` function | The list of failed steps, in the two failure scopes, and the error text taken from it | Standard Logic Apps structure | **Unverified**: neither failure scope has run on a real site, in travel or here, so where the error message is found is Unverified too |

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
4. **A nested failure scope inside the branch reports a failure.** When the approval email cannot be sent, or its status cannot be recorded, the scope On approval failure should run: Mark approval failed sets Package status to Failed with the error text (the app lists it under Needs attention as "Approval email failed", and the request page offers Retry approval email), and Send approval failure email tells the administrator. The failure scope for packaging, On failure, has never run on a real site either. **Not tested at the checkpoint**: the only ways to make it run on purpose are to break a connection that other flows share or to edit data by hand, which this file and travel D-068 rule out (`docs/CHECKPOINT.md` step 34). It stays Unverified until a real failure. Seen when: a failed approval shows Failed with the error in the app, the run history shows the failure scope ran, and, if the Outlook connection can still send, "Purchase approval email failed: ..." arrives.
5. **The approver addresses are the site Owners read when the package was made.** Set-up reads them (`getFlowSettings`) and writes them into the package; they are not read again, so someone who stops being an Owner keeps getting the email until a new package is made and imported. Unverified that an administrator can read the Owners group (strategy section 17); if not, Set-up falls back to the administrator's own address, and its green box then says "your own address, because the site Owners could not be read". Seen when: the green box says "the site Owners" and lists their addresses, the Send approval email step in the imported flow lists the same addresses in its To field, and each of them receives the email. With only one Owner, the Owners' address and the fallback are the same address, so only the green box's wording tells them apart.

If any fails, the fix goes into `flowPackage.ts` and a new package is made from the Set-up page; the flow is never edited by hand, so this file and the code stay true.
