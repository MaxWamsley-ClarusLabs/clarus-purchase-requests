# Draft update for the "Clarus purchase request processing" skill

For Max to review and paste. This is a draft: nothing outside this repository was changed. The skill lives in Max's Claude skills (`clarus-purchase-request-processing`, `SKILL.md`); Claude has no way to edit it from the app project, and it was read for this draft only (a read-only copy in the session).

## Why it needs updating

Four things in the skill are out of date after the Ledger (version 1.0.3.0, P-052 to P-060) and the filing change (version 1.0.6.0, P-065):

1. **The CSV has 32 columns, not 31.** The extra column is **QuickBooks account** (P-038). The app's own test checks the count of 32.
2. **The skill does not know the Ledger.** Bookkeepers now choose the QuickBooks account and class in the app and mark lines Posted. The "Class: CSV has none" gap rule is out of date: the class is chosen in the Ledger, not in the CSV.
3. **The skill does not know the receipt archive or the nightly backup.** Receipts are copied to `App Output/Purchase_Receipts/<request folder>/` (Documents library of the Forms and Apps site; since app 1.0.5.0) and a dated ledger copy is saved nightly in `App Output/Ledger_Backups/`.

4. **Where the processed folder is filed.** The skill's 2026-10-06 decision says Max moves the folder to `Accounting/Purchases/[year]/`. Since version 1.0.6.0 the app and its email name the place: **Internal Records > Accounting and Receipts > Accounting [year] > Purchase Requests** (Edit 7). Max moves the folder by hand; the app only links to it.

What did **not** change: the request folder (receipt copies, quote copies and the CSV) is still placed in `Purchases_To_Process`, now at `Documents / App Output / Purchases_To_Process` on the Forms and Apps site (the Executive Team site is retired), the CSV is still one row per line, and the skill still prepares an entry sheet for Max; QuickBooks stays read-only. Whether Max keeps using the skill once the bookkeepers work from the Ledger is his decision; the text below keeps both ways working.

## Edit 1. Folder contents (replace the whole section)

Find the section that begins `## Folder contents` and replace its paragraph with:

> `PR-NNNN_Purchases.csv` (UTF-8 with BOM, **32 columns**, one row per purchase line; strip a leading apostrophe on text starting with = + - @), receipts `R01_<name>` (`R01-2_` second file on a row), quotes `Q01_<name>`. Amounts are plain decimals. Request-level columns repeat on every row. The 32nd column is **QuickBooks account** (the category's account number and name, for example `6182 R&D Materials & Supplies`). The CSV has no class and no Posted column. Read image-only PDFs by rasterizing them; zoom on totals before quoting digits.

## Edit 2. New section, after "Folder contents"

> ## The Ledger, the receipt archive and the nightly backup (app 1.0.3.0)
> - The Purchase Requests app has a **Ledger** page. Bookkeepers (members of the SharePoint group Purchase Bookkeepers, and the site Owners) give every bought line a QuickBooks **account** and **class**, chosen from the exact QuickBooks lists (56 accounts, 7 classes, exported 2026-11-15), optionally a **note**, and mark it **Posted** after entering it in QuickBooks. The app records who posted and when, and the line's amount at that moment.
> - **A class is required on every line** (QuickBooks needs one), so a line cannot be Posted without an account and a class. The app does not choose the class.
> - A Posted line that was changed afterwards shows "Changed since posted: was $X, now $Y". Treat it as a flag to check QuickBooks, not an instruction.
> - **Equipment and Other lines** show "Administrator decides" until Max confirms the account (6175, or 1415 Fixed Assets:Equipment). Do not guess it.
> - **Receipt archive:** the receipts of each request are also copied to `App Output/Purchase_Receipts/<same folder name>/`. That copy stays put when Max moves the request folder to its year folder, and the Ledger's receipt links point to it. A request packaged before the archive existed has no archive copy.
> - **Nightly backup:** a dated pair of files, `Ledger_<date>_<time>.csv` and `.md`, is saved every night at 02:30 Central in `Documents / App Output / Ledger_Backups` on the Forms and Apps site, with every bought line, its account, class, note, Posted flag, who and when. Nothing is overwritten. To see what the bookkeepers decided, read the newest backup or the Ledger's **Download Excel** file before asking Max.
> - The skill still never edits the Ledger, the lists or QuickBooks.

## Edit 3. Gap rule "Class" (replace)

Find the bullet that begins `- Class: CSV has none;` and replace it with:

> - Class: the CSV has none. If the Ledger (or the newest backup) shows the class the bookkeeper chose for the line, use it and name the source. Otherwise "Project or grant code" is not a class: map to 1.01 only when the code clearly names the NSF Phase I award and nothing in the row conflicts; otherwise ask and mark Human_Review_Needed. Valid classes, exactly as QuickBooks writes them: `5.0 Internal R&D`, `1.0 Grants:1.01 NSF Phase 1 SBIR`, `1.0 Grants:1.03 NSF Phase 2 SBIR`, `1.0 Grants:1.02 X Competition`, `8.0 Indirect Expenses`, `2.0 Commercial`, `9.0 Unallowable Expenses`. (`1.0 Grants` on its own and `3.0 Other Income` are not offered for purchases.)

The class names above are the exact text the app stores, from `Classes.pdf` (2026-11-15).

## Edit 4. Gap rule "Payment account" (add one sentence)

Append to the bullet that begins `- Payment account:`:

> The Ledger does not hold a payment account either; Max still names it per batch.

## Edit 5. Decisions (add one line, dated)

> - 2026-11-17: The bookkeepers can give accounts and classes and mark lines Posted in the app's Ledger. Where the Ledger or the newest nightly backup already shows an account and class for a line, use them and say so; do not choose again. Max decides whether the entry sheet is still prepared for each PR or the Ledger replaces it.

## Edit 6. Output (add one sentence)

Append to the section `## Output`:

> Where a line was already given an account and class in the Ledger, show them in the table with "from the Ledger" beside them, and flag any difference from the category's account.

## What Claude did not decide for Max

- Whether the skill keeps producing a full entry sheet per PR now that bookkeepers post from the Ledger. The edits above keep it working either way.
- Whether the skill should read the Ledger backup files. It has been written to use them when present, never to require them.
- The account for Equipment lines. Max decides per line, as before.

## Edit 7. Where the folder is filed (replace one sentence, add one decision line)

In the Decisions line dated `2026-10-06`, find the sentence that begins `Max moves the folder to` and ends `created if missing) first;` and replace it with:

> Max moves the folder to `Internal Records / Accounting and Receipts / Accounting [year] / Purchase Requests` (year of the earliest purchase date, which is also the first four characters of the folder name; Max creates the year folder if missing) first;

Then add one line under Decisions, dated:

> - 2026-11-25: The app and its submission email link to the request folder and to the filing folder, and Max files the folder by hand (moving between the Forms and Apps site and Internal Records is a copy: he checks the copy, then deletes the original). Claude never moves, renames or deletes the folder or the receipt archive copy, and never writes to the filing folder unless Max tells it to. The receipt archive copy in `App Output / Purchase_Receipts` stays where it is.

The last sentence of the 2026-10-06 line ("PROVISIONAL reading ... the Receipt_Log file link points into the PR folder") is unchanged: Max still decides whether renamed receipts stay in the PR folder.
