# Clarus Purchase Request App

Replacement for Clarus Labs' current non-travel purchase process: the F2 Purchase Request and Approval Form, completed in Word and sent through the Purchasing Receipt Team on Microsoft Teams with the supervisor @-mentioned. Employees enter a purchase request with its lines in one grid. A vendor total of $500 or more goes to the approver (the site Owners, today Max Wamsley) first. After buying, the employee attaches receipts and submits; a Power Automate flow then places a request folder (receipt copies, quote copies and a CSV file) in `Accounting/Purchases/Purchases_To_Process` and emails the administrator.

It is a near copy of the Travel Expense App (repository `MaxWamsley-ClarusLabs/clarus-travel-expense`, branch `claude/travel-expense-evaluation-uo38kg`, commit b1af343), which is read only for this project: never push, commit, comment or open anything there. Copy from it only.

## Read first, every session

1. `docs/STATUS.md`: current stage, what is built and tested, next step.
2. `docs/CHANGELOG.md`: every change made so far, with the reason for each.
3. `docs/DECISIONS.md`: every decision so far (P-001 onward). Do not reopen a decision unless new facts affect it, and say so explicitly if they do. "Provisional (Claude, awaiting Max)" decisions stay in force until Max answers.
4. `docs/QUESTIONS_FOR_MAX.md`: the open questions, numbered, with options and where a change would go.
5. `docs/STRATEGY.md`: what carries over from travel, what changes, the workflow, the output package, the flow, the stage plan (which ends with the new purchasing policy).
6. `.claude/skills/iterative-workshop/SKILL.md`: the process for every decision stage.
7. The travel project's records, for any decision not repeated here: its `CLAUDE.md`, `docs/DECISIONS.md` (D-001 to D-079), `docs/STRATEGY.md`, `docs/DATA_MODEL.md` and `flow/FLOW.md`. Its decisions carry over unchanged unless `docs/DECISIONS.md` here says otherwise. Anything older that suggests an architecture debate is superseded.

## Working rules

- **Pause and ask.** If there is more than one reasonable option or any doubt, stop and ask Max before continuing. Give the options, the trade-off, a recommendation and why. Number questions; ask no more than five at a time. *Exception, for the first overnight build only (2026-09-30, P-013):* Max asked Claude to keep going, take the recommended option, record it as "Provisional (Claude, awaiting Max)" in `docs/DECISIONS.md` and list it in `docs/QUESTIONS_FOR_MAX.md`. From Max's next message the normal rule applies again.
- **No policy document.** The old P4 policy is not used. Max will write a new purchasing policy with Claude after the app is complete (the last stage). Every rule (thresholds, quote rule, categories, certification sentence, account mapping) lives in `app/src/domain/purchaseRules.ts` so the new policy changes one place.
- **Stages.** Follow the stage plan in `docs/STRATEGY.md` section 14. Decision stages end with an explicit readiness gate that Max answers yes to.
- **Max's hands-on work.** Max installs or tests in Microsoft 365 only at the test-site checkpoint (`docs/CHECKPOINT.md`) and after all coding is complete. Give him numbered steps that name the exact screen and value.
- **Records.** Every commit adds an entry to `docs/CHANGELOG.md` (what changed, which files, why), including any reads of outside systems. After each stage, update `docs/STATUS.md` and add new decisions to `docs/DECISIONS.md`. Keep implemented, tested, piloted and in production clearly separate.
- **Evidence.** Label Microsoft licensing, pricing and platform-limit claims as Verified or Unverified, with source and date.
- **Writing style.** No em dashes in any document. Plain, direct language.
- **Security.** Never display stored list text as HTML. Employees can edit their own items directly (travel D-002), so any stored field may contain anything, including an approval. The email summaries are plain text; only the flow turns them into HTML, after escaping (travel D-067). The flow's destination is fixed in `export/flowPackage.ts`, never taken from list data.

## Stack

- SharePoint Framework (SPFx) 1.23.2, Heft toolchain, React 17.0.1, TypeScript 5.8.3. Node.js 22.14 or later and below 23 (this environment has 22.22.0).
- `app/` is one project: the SPFx web part, built with Heft, and a local Vite preview on sample data.
- Data: three SharePoint lists on the shared Forms and Apps site (Purchase Requests, Purchase Request Lines, Purchase Submissions; P-007). Receipts and quotes are list attachments.
- One Power Automate cloud flow, owned by Max, standard connectors only (SharePoint, Office 365 Outlook), delivered as an import package made by the Set-up page. The approval email is a branch of the same flow (P-018).
- No app registration, no Microsoft Graph permissions, no Azure resources.

Layout: `app/src/domain` holds every business rule (`purchaseRules.ts` is the policy: thresholds, quote rule, categories, account suggestions, certification; the rest are statuses, validation, totals, naming, messages, defaults and suggestions); `app/src/export` builds the CSV, the email texts and the submission package, and writes the flow and its import package; `app/src/reading` is the receipt reader (unchanged from travel), and `app/config/webpack-patch/` puts its files in the app package; `app/src/data` is the only code that reads or writes data (`PurchaseDataService` interface, with `mock/` for the preview and tests and `sharepoint/` for the real site); `app/src/ui` holds screens and the KFA theme; `app/src/content` holds the Instructions text (also SOP Part A); `app/src/webparts/purchaseRequests` is the SPFx entry point and manifest; `app/config`, `app/eslint.config.js` and `app/teams` are SPFx build settings; `app/preview` is the local preview harness, its tools and the SOP check; `flow/` holds `FLOW.md`, `example/definition.json` (a generated example) and the package checker in `tools/`; `test/fixtures` holds synthetic data only.

## How to run and test

From `app/`:

- `npm install` (first time)
- `npm test`: unit tests (Vitest; tests use global `describe`, `it`, `expect` so they also run under Jest)
- `npm run typecheck`: TypeScript check
- `npm run format` / `npm run format:check`: Prettier
- `npm run preview`: the app on sample data at `http://127.0.0.1:5173/?user=jane` (or `sam`, or `admin`; `admin` is the approver and administrator)
- `npm run screenshots` (with the preview running): recreates `docs/prototype/*.png` and reports browser errors. Uses the Chromium at `/opt/pw-browsers/chromium`
- `npm run build`: the SharePoint build (TypeScript, SPFx lint rules, webpack), the unit tests again under Jest, and the app package at `app/sharepoint/solution/clarus-purchase-requests.sppkg`
- `npm run sop`: rewrites `docs/SOP.md` Part A from the Instructions text (`npm test` fails if they differ)
- `npm run flow-example`: rewrites `flow/example/definition.json` (`npm test` fails if it is out of date, and checks the package with `flow/tools/check_package.py`, which needs `python3`)
- `node preview/tools/generate-sample-receipts.mjs`: recreates the synthetic receipts in `test/fixtures/receipts`

Run tests, typecheck and format check before every commit, and `npm run build` when app code or build settings change, and before every push. GitHub runs all of them on every pull request (`.github/workflows/build.yml`).

## Must not be touched

- The travel app and its repository (read only here).
- The current Power Apps apps and their SharePoint lists and records.
- Anything that already exists in the Accounting folder. The flow only creates new folders and files inside `Accounting/Purchases/Purchases_To_Process` (and the `Purchases` folder itself if missing).
- `Accounting/Receipts_To_Process`, QuickBooks, `Clarus_Receipts_and_SBIR_Tracker_2026.xlsx`, `PurchasesLog_2026.xlsx`, `Clarus_Accounting_SOP.md`, `Clarus_Purchase_Receipt_Agent_SOP.txt`, `Intuit_Account List.xlsx`, `Tax Docs`, `Payroll stuff`.
- Microsoft 365 and Entra ID configuration. Max makes all changes there.

## Security and data

- Never commit real receipts, card numbers, bank details, employee personal data, passwords, secrets or tokens. Use synthetic data in `test/fixtures/`: fictional vendors and people.
- Do not put credentials in environment variables or chat. If one is ever needed, tell Max what it is and where it should be stored.

## Environment

- Claude Code cloud session. npm and GitHub are reachable. Microsoft hosts (learn.microsoft.com, graph.microsoft.com, SharePoint and others) are blocked. If a step needs a blocked host, stop that step, note which domain and why, and carry on with other work. Do not work around the restriction.
- Do not use the Microsoft 365, Outlook, Teams, SharePoint or QuickBooks connectors at all during the overnight build. Afterwards, ask before any read; never write through a connector.
- The QuickBooks connector is never used by the app or the CSV. The suggested QuickBooks account per category is Unverified, to confirm with Max (P-025).

## Git

- Work on branch `claude/festive-ramanujan-nljy44`, one draft pull request for the whole build.
- One branch and one pull request for the whole build, with a commit for each stage. Do not merge to `main` or deploy without Max's approval.
- Small commits with clear messages. Each approved checkpoint stays restorable from git history.
