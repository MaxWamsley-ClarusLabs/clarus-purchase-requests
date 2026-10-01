# Status

**Last updated:** 2026-10-01 (see `docs/CHANGELOG.md` for every change)
**Current stage:** The overnight build is finished through Stage 9. Stage 10 (review with Max) is under way: on 2026-10-01 Max answered questions 1 to 5 and 24 to 29, and Claude built what he decided: the approver buys by default, the item link, and the 13 QuickBooks-account categories (P-037 to P-042). Everything is on branch `claude/festive-ramanujan-nljy44` and in draft pull request MaxWamsley-ClarusLabs/clarus-purchase-requests#1. Nothing is merged, deployed or installed. Max has since answered questions 30 to 32 (accept; any Owner can return a request, built; Equipment capitalization waits for the policy). Next: Max follows `docs/CHECKPOINT.md` on a test site, and Claude fixes what it finds.

## Summary

| Area | State |
|---|---|
| Implemented (on the branch, not merged) | The app: a request in three steps (details, purchases, review). **Who buys it is chosen on each request, and the approver is the default (P-037):** the employee says what to buy (vendor, what and why, an estimated amount, the category, the item's web page or why there is none, a quote at $500 or more) and sends it with the certification; every such request goes to the approver, whatever the amount; the approver approves, opens it to buy, changes the rows to what was bought, adds rows (shipping, tax), attaches the receipts, and chooses Mark purchased, which builds the folder and CSV (P-040, P-041). The rows as the employee sent them stay beside what was bought. When the employee buys it instead, the first build's path is unchanged: approval at a vendor total of $500 or more, receipts, certification at Submit. **The 13 categories are QuickBooks accounts (P-038):** the CSV has the number and exact name, and Equipment and Other leave the account to the administrator. The administrator pages (Approvals with a To buy list, Requests to process, Needs attention, All requests, Set-up). Every policy number and every piece of policy wording is in `app/src/domain/purchaseRules.ts`. The CSV (31 columns) and the two emails. The SharePoint data service and a mock service for the preview, which follow the same contract tests. The flow package generator, with the approval email as a branch of the same flow (Test and Live packages; unchanged by this build) |
| Tested (on sample data and a simulated SharePoint, not a real site) | 771 unit tests; the SharePoint service is tested against an in-memory fake of SharePoint, and both services run the same contract tests. Format check, type check and the SharePoint build pass, and 767 of the tests run again under Jest in that build. A browser script walks both ways of buying as Jane, Sam and the administrator on sample data (111 checks, no browser errors) and recreates the 38 screenshots. The first build had seven independent reviews in two rounds. The approver-buys build had four more (the data layer, a browser test, a requirements and records audit, and the export and flow), run on the first commit of it; their findings are fixed except the known limits below (`docs/CHANGELOG.md`, `docs/DECISIONS.md` P-042). The GitHub build keeps the `.sppkg` as a download; its result for the newest commit is on the pull request's Checks tab |
| Installed in Microsoft 365 (test) | Nothing |
| Piloted | Nothing |
| In production | Nothing. The current Word form and the Teams posting are unchanged and still in use |

**Not tested anywhere real.** SharePoint (creating the lists, permissions, attachments, the Owners group, **the approver adding rows, files and a package to an employee's request, and SharePoint hiding those rows from the employee**), Power Automate (importing the package, the nested If, the approval email to several Owners, the failure scope), Outlook, and the receipt reader on real receipts inside SharePoint. These are what the test-site checkpoint is for. Microsoft's documentation is blocked in this environment, so every Microsoft platform claim not carried over from the travel project's confirmed checkpoint is **Unverified** (`docs/QUESTIONS_FOR_MAX.md` question 23, `flow/FLOW.md`).

## Stages

| Stage | State | Notes |
|---|---|---|
| 1. Read and records | Done, 2026-09-30 | `CLAUDE.md`, `docs/STRATEGY.md`, `DECISIONS.md` (P-001 to P-042), `DATA_MODEL.md`, `SOP.md`, `QUESTIONS_FOR_MAX.md`. The travel project and the F2 form were read; the attached form's $100 and "over $500" wording differs from Max's $500 decision (P-005, question 2) |
| 2. Copy | Done, 2026-09-30 | The travel app, tooling and CI under the new name and new IDs |
| 3. Rules | Done, 2026-09-30 | `purchaseRules.ts` and the rest of the domain layer; the CSV, email and submission code; the data interface |
| 4. Data | Done, 2026-10-01 | Lists, mapping, SharePoint and mock services, fake SharePoint, sample data |
| 5. Screens | Done, 2026-10-01 | All screens, the preview with Jane, Sam and the administrator, 38 screenshots and a README in `docs/prototype/`, the Instructions text and SOP Part A, synthetic sample receipts |
| 6. Export and flows | Done, 2026-10-01 | The flow package with the approval branch, `flow/FLOW.md`, the example definition |
| 7. Checks | Done, 2026-10-01 | Unit tests, format, type check, the SharePoint build and the GitHub build, the screenshot and browser-check script, and two rounds of independent reviews and their fixes. Done inside the Stage 5, Stage 6 and review commits; there is no separate Stage 7 commit |
| 8. Checkpoint steps | Done, 2026-10-01; rewritten for the approver-buys build the same day | `docs/CHECKPOINT.md`: 35 numbered steps for the test site |
| 9. Morning report | Done, 2026-10-01 | This file, `docs/QUESTIONS_FOR_MAX.md`, the draft pull request. Committed with the second review round; there is no separate Stage 9 commit |
| 10. Review with Max | Under way | Questions 1 to 5 and 24 to 32 answered (P-037 to P-042); 24 to 31 are built, and 32 waits for the purchasing policy. Waiting for Max's test-site checkpoint |
| 11. Test-site checkpoint | Waiting on Max | Max follows `docs/CHECKPOINT.md` |
| 12. Security review and SOP proof pass | Not started | Includes the accepted risks P-029 and P-033 and the gap in question 22 |
| 13. Pilot | Not started | |
| 14. Production | Not started | |
| 15. New purchasing policy (last stage) | Not started | Max writes the policy with Claude; `purchaseRules.ts`, the Instructions, the SOP and the form text follow. The old P4 policy was not used or looked for |

## Pending items

- **Answered by Max on 2026-10-01 and built:** questions 2, 4 and 5 (yes), 3 ("do whatever you think"), 1 (the accounts and categories), 24 (the approver buys by default, per request), 25 (the approver attaches the receipt and chooses Mark purchased; the employee also gives the item's web page), 26 (the employee ticks the certification when sending), 27 (the 13 categories), 28 (the item link or a reason is required when the approver buys) and 29 (the approver may change everything and add or remove rows). Recorded in `docs/DECISIONS.md` (P-037 to P-042) and `docs/SOP.md`. The other provisional choices stay in force until he answers.
- **Answered by Max on 2026-10-01 (second message):** 30 (the employee will not see the rows the approver adds: accepted), 31 (any Owner can return an approved request: built), 32 (where Equipment is capitalized; a QuickBooks class: "not sure", so it waits for the purchasing policy). No question is open for Max now.
- Max to follow `docs/CHECKPOINT.md` on a test site (about 90 minutes). Step 33 is the only test of what SharePoint does with the approver's rows on an employee's request, and needs a colleague who is not an Owner.
- **Before go-live:** if the QuickBooks chart of accounts has changed, export it again and compare it with `purchaseRules.ts` (checkpoint step 35). The numbers and names are from Max's message and were compared on 2026-10-01 with the list he pasted next (all 12 match); Claude did not open the spreadsheet.
- Known gaps, recorded for Max: after approval only vendor amounts are re-checked (question 22); an employee could make the flow send an approval email to the Owners with text of their choosing (question 19); an employee could mark their own request Approved directly in SharePoint (question 15), or edit the certification kept on their approval request (P-041); the approver's rows on an employee's request may be invisible to the employee (question 30, Unverified).
- Known limits of the approver-buys build, not fixed (P-042): a request the recorded approver cannot buy can be returned by any Owner but not bought by anyone else, and a return waits until the approver deletes rows they added; if two Owners are involved, the first Owner's package leaves the request's history; the approval record could exceed a SharePoint multi-line column with about thirty rows of very long links (Unverified); the employee sees every row in the preview but will not see the approver's rows on SharePoint (Unverified).
- Known limits, not fixed: typing slows with hundreds of rows; files are judged by extension only; two browser tabs adding rows at the same moment can number them the same (SharePoint only); leaving a page within about a tenth of a second of typing can lose the last characters (the browser asks first); a site address with an apostrophe cannot be used (Set-up refuses to make the package and says why).
- The travel app's own open items (colleague test, Mark processed, site choice, Teams app details) are tracked in its repository and do not block this project.

## Next step

Max follows `docs/CHECKPOINT.md` on a test site. Claude fixes what the checkpoint finds (Stage 11), then the security review and the SOP proof pass (Stage 12). The new purchasing policy is the last stage (Stage 15).
