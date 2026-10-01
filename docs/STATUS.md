# Status

**Last updated:** 2026-10-01 (see `docs/CHANGELOG.md` for every change)
**Current stage:** The overnight build is finished through Stage 9. Everything is on branch `claude/festive-ramanujan-nljy44` and in draft pull request MaxWamsley-ClarusLabs/clarus-purchase-requests#1. Nothing is merged, deployed or installed. Next: Max reads this, answers `docs/QUESTIONS_FOR_MAX.md` (the first five first), and follows `docs/CHECKPOINT.md` on a test site.

## Summary

| Area | State |
|---|---|
| Implemented (on the branch, not merged) | The app: a request in three steps (details, purchases, review), approval inside the app for any vendor total of $500 or more, receipts and quotes, certification and submission, the administrator pages (Approvals, Requests to process, Needs attention, All requests, Set-up). Every policy number and every piece of policy wording is in `app/src/domain/purchaseRules.ts` (the settings that P-023, P-027 and P-030 name sit in `defaults.ts` and `statuses.ts`). The CSV (28 columns) and the two emails. The SharePoint data service and a mock service for the preview. The flow package generator, with the approval email as a branch of the same flow (Test and Live packages) |
| Tested (on sample data and a simulated SharePoint, not a real site) | 656 unit tests; the SharePoint service is tested against an in-memory fake of SharePoint. Format check, type check and the SharePoint build pass, and 652 of the tests run again under Jest in that build. A browser script walks the whole approval path as Jane, Sam and the administrator on sample data (71 checks, no browser errors). Seven independent reviews in two rounds were run (a requirements audit, three code reviews, two browser tests and a records-against-code check) and their confirmed findings fixed, except the limits listed under Pending items (`docs/CHANGELOG.md`). The GitHub build keeps the `.sppkg` as a download; its result for the newest commit is on the pull request's Checks tab |
| Installed in Microsoft 365 (test) | Nothing |
| Piloted | Nothing |
| In production | Nothing. The current Word form and the Teams posting are unchanged and still in use |

**Not tested anywhere real.** SharePoint (creating the lists, permissions, attachments, the Owners group), Power Automate (importing the package, the nested If, the approval email to several Owners, the failure scope), Outlook, and the receipt reader on real receipts inside SharePoint. These are what the test-site checkpoint is for. Microsoft's documentation is blocked in this environment, so every Microsoft platform claim not carried over from the travel project's confirmed checkpoint is **Unverified** (`docs/QUESTIONS_FOR_MAX.md` question 23, `flow/FLOW.md`).

## Stages

| Stage | State | Notes |
|---|---|---|
| 1. Read and records | Done, 2026-09-30 | `CLAUDE.md`, `docs/STRATEGY.md`, `DECISIONS.md` (P-001 to P-036), `DATA_MODEL.md`, `SOP.md`, `QUESTIONS_FOR_MAX.md`. The travel project and the F2 form were read; the attached form's $100 and "over $500" wording differs from Max's $500 decision (P-005, question 2) |
| 2. Copy | Done, 2026-09-30 | The travel app, tooling and CI under the new name and new IDs |
| 3. Rules | Done, 2026-09-30 | `purchaseRules.ts` and the rest of the domain layer; the CSV, email and submission code; the data interface |
| 4. Data | Done, 2026-10-01 | Lists, mapping, SharePoint and mock services, fake SharePoint, sample data |
| 5. Screens | Done, 2026-10-01 | All screens, the preview with Jane, Sam and the administrator, 33 screenshots and a README in `docs/prototype/`, the Instructions text and SOP Part A, synthetic sample receipts |
| 6. Export and flows | Done, 2026-10-01 | The flow package with the approval branch, `flow/FLOW.md`, the example definition |
| 7. Checks | Done, 2026-10-01 | Unit tests, format, type check, the SharePoint build and the GitHub build, the screenshot and browser-check script, and two rounds of independent reviews and their fixes. Done inside the Stage 5, Stage 6 and review commits; there is no separate Stage 7 commit |
| 8. Checkpoint steps | Done, 2026-10-01 | `docs/CHECKPOINT.md`: 34 numbered steps for the test site |
| 9. Morning report | Done, 2026-10-01 | This file, `docs/QUESTIONS_FOR_MAX.md`, the draft pull request. Committed with the second review round; there is no separate Stage 9 commit |
| 10. Review with Max | Waiting on Max | Max answers `docs/QUESTIONS_FOR_MAX.md`; the first five first |
| 11. Test-site checkpoint | Waiting on Max | Max follows `docs/CHECKPOINT.md` |
| 12. Security review and SOP proof pass | Not started | Includes the accepted risks P-029 and P-033 and the gap in question 22 |
| 13. Pilot | Not started | |
| 14. Production | Not started | |
| 15. New purchasing policy (last stage) | Not started | Max writes the policy with Claude; `purchaseRules.ts`, the Instructions, the SOP and the form text follow. The old P4 policy was not used or looked for |

## Pending items

- Max to answer `docs/QUESTIONS_FOR_MAX.md`. Each provisional choice is built as recommended and stays in force until he answers.
- Max to follow `docs/CHECKPOINT.md` on a test site (about 75 minutes).
- Known gaps, recorded for Max: after approval only vendor amounts are re-checked (question 22); an employee could make the flow send an approval email to the Owners with text of their choosing (question 19); an employee could mark their own request Approved directly in SharePoint (question 15); the suggested QuickBooks accounts are Unverified (question 1).
- Known limits, not fixed: typing slows with hundreds of rows; files are judged by extension only; two browser tabs adding rows at the same moment can number them the same (SharePoint only); leaving a page within about a tenth of a second of typing can lose the last characters (the browser asks first); a site address with an apostrophe cannot be used (Set-up refuses to make the package and says why).
- The travel app's own open items (colleague test, Mark processed, site choice, Teams app details) are tracked in its repository and do not block this project.

## Next step

Max reads the morning report, answers the first five questions in `docs/QUESTIONS_FOR_MAX.md`, and follows `docs/CHECKPOINT.md`. Claude then makes any changes his answers need and fixes what the checkpoint finds (Stages 10 and 11).
