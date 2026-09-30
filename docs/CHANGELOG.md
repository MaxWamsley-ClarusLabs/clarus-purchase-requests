# Change log

A record of every change made in this project: what changed, which files, and why. It exists so that another developer or AI can pick up the work and understand not just the current state but how it got there.

**How this file relates to the other records**
- `docs/DECISIONS.md`: what was decided, the options and why (the reasons behind choices).
- `docs/STATUS.md`: where the project stands now and the next step.
- `docs/CHANGELOG.md` (this file): what was actually done, in order, including reads of outside systems.

**Rule:** every commit adds an entry here. Newest entries are at the bottom. The entry for the current commit refers to it by its message.

---

## 2026-09-30. Starting point (by Max, before Claude's work)

| Commit | What | Why |
|---|---|---|
| 6985a9c | Repository created with `README.md` | New project |

## 2026-09-30. Reads of outside systems (before any file was written)

- **Source repository, read only:** attached `MaxWamsley-ClarusLabs/clarus-travel-expense` to the session with read access and cloned branch `claude/travel-expense-evaluation-uo38kg` (commit b1af343) into `/home/user/clarus-travel-expense`. Read its `CLAUDE.md`, `docs/STATUS.md`, `docs/DECISIONS.md` (D-001 to D-079), `docs/STRATEGY.md`, `docs/DATA_MODEL.md`, `docs/PENDING_CHANGES.md`, `docs/SOP.md`, `docs/STAGE8_CHECKPOINT.md`, `docs/CHANGELOG.md`, `flow/FLOW.md`, `.claude/skills/iterative-workshop/SKILL.md`, the receipt-processing skill excerpt, and all of the app's source, tests, tooling and configuration. Nothing was written, committed, commented on or opened in that repository.
- **The attached form:** read `F2_PurchaseRequest_Form_P4.docx` (uploaded twice; the two copies are identical) by unpacking its document XML. No other document was read and the old P4 policy was not looked for.
- **Not used:** the Microsoft 365, Outlook, Teams, SharePoint and QuickBooks connectors. Microsoft hosts were not contacted.

## 2026-09-30. Stage 1, read and records

| Commit | What | Why |
|---|---|---|
| Stage 1 commit | Created `CLAUDE.md`, `docs/STRATEGY.md` (what carries over, what changes, the rules, the workflow, the package, the flow branch, the stage plan ending with the new purchasing policy), `docs/DECISIONS.md` (P-001 to P-014 decided by Max; P-015 to P-031 provisional), `docs/DATA_MODEL.md` (three lists), `docs/STATUS.md`, `docs/SOP.md` (Part B and C drafted), `docs/QUESTIONS_FOR_MAX.md`, and this file; updated `README.md` | Stage 1 of Max's build order. The provisional decisions record each choice Claude made where the prompt was silent, with options and reasons, as Max asked. The attached F2 form's $100 approval and "over $500" quote wording differs from Max's $500 decision; his prompt wins and the difference is question 2 |
