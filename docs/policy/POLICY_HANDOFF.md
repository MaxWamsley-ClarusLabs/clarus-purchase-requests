# Handoff: how the P4 Purchasing policy and the policy tracker were made

For another Claude chat that will write more Clarus Labs policies (for example P3 Travel Reimbursement, or the SOP) in the same style. Written 2026-11-24 by the Purchase Request App chat. Read it with the files listed in section 1. Nothing here was published or written to SharePoint.

## 1. What to attach to the new chat

| File | Where it is | Why |
|---|---|---|
| `Clarus Labs Master Template.dotx` | Executive Team site, Shared Documents, `05_Templates/Word` (controlling copy). Also in Internal Records, Templates and Forms, Word | The Word template. The Microsoft 365 connector cannot download a `.dotx`, so Max must upload it |
| `Clarus Labs Logo - Horizontal.png` | Executive Team site, `05_Templates/Brand Assets/Logos` | Header logo for the Excel tracker (Word gets its logo from the template) |
| `Clarus PPT Theme.thmx` | Executive Team site, `05_Templates/PPT` | The brand theme for Excel. Not yet supplied: only the Word theme (the Office default) was. The tracker was built without it |
| `P3_TravelReimbursement_Policy.docx` | Max's example (content, not the style he wants) | Shows the policy layout and tone |
| `P4 Purchasing Policy_DRAFT (R1).docx` | `docs/policy/` | The finished example in the target style |
| `Clarus Labs Policy Tracker.xlsx` | `docs/policy/` | The finished tracker |
| `tools/build_policy_docx.py`, `tools/build_tracker.py` | `docs/policy/tools/` | The scripts that built both (section 6) |
| This file and `docs/DECISIONS.md` P-063 | repo | The decisions |

The brand rules come from the `clarus-brand-style` skill. Where this file and that skill differ, the skill and Max's latest instruction win.

## 2. What Max asked for, in order

1. A Word document in one common template for all Clarus documents. His example (the P3 Travel policy) had the content layout he liked but not the style.
2. First the policy, not the SOP: an official policy for all employees, to post on the SharePoint policy tab.
3. An Excel document that tracks all Clarus Labs policies.
4. Use the iterative-workshop process: ask the material questions, get a yes, then draft.

## 3. Decisions Max made (2026-11-24)

| Topic | Decision |
|---|---|
| Template | Use the Clarus brand style and the Clarus Labs Master Template together. Reading the template through the connector was allowed. |
| Order | Policy first, SOP second |
| Number | Purchasing policy is **P4**. P3 stays the Travel Reimbursement policy, which Max will draft with the Travel app. |
| Rules | R0 (`docs/POLICY.md`, 2026-10-01, decision P-044) is the base. None of its rules change. |
| Owners' own purchases | State what the Purchase Requests app does: an Owner may approve their own request (recorded as self-approved) and may record a purchase already made (no approval step, no employee certification, a receipt or a reason still needed). |
| Tracker | Only P4 for now. P3 is added when Max has drafted it. |
| Placeholders | Leave the effective date and the record retention period as placeholders. |
| Approved by | "Max Wamsley, CEO". |
| Applies to | "All employees and anyone else who buys on behalf of Clarus Labs". |
| Header date | The draft date (November 24, 2026), not the effective date. |

## 4. The policy: structure and sources

Layout follows Max's P3 example: a "Policy Field / Details" table (Policy Title, Policy Number, Effective Date, Approved By, Applies To), then short headings, bold lead-ins on bullets, tables where a rule has two columns, and an appendix. Headings are not numbered.

| Section | Content source |
|---|---|
| Purpose | New text, based on R0 section 1 |
| General Provisions | R0 section 1 |
| How a Purchase Is Requested | R0 section 2 (the button-by-button steps were left out; they belong in the SOP) |
| Approval (table plus bullets) | R0 section 3, plus the Owner rules above |
| Employee-Paid Purchases and Reimbursement | R0 section 4 |
| Quotes | R0 section 5 |
| Receipts, Certification and Records | R0 section 6. The certification sentence is exactly `CERTIFICATION` in `app/src/domain/purchaseRules.ts` |
| Categories and QuickBooks Accounts | R0 section 7, with Appendix A |
| Purchases Paid With Grant Funds | R0 section 8 |
| Unallowable Purchases | R0 section 9 |
| Roles and Responsibilities (table) | R0 section 10 |
| Policy Exceptions | R0 section 11 |
| Appendix A | The 13 categories, accounts and "what it covers" text, taken from `CATEGORIES` in `purchaseRules.ts` |

The rules (checked against `app/src/domain/purchaseRules.ts` on 2026-11-24): approval and quote threshold $500 per vendor (`APPROVAL_THRESHOLD_CENTS`, `QUOTE_THRESHOLD_CENTS`, both 50000), 10% overrun tolerance (`OVERRUN_TOLERANCE_PERCENT`), the approver buys by default and every approver-bought request goes to the approver whatever the amount. Two rules are in the policy only and the app does not check them: the 30-day submission deadline, and prior written NSF program officer approval for equipment over $5,000 per item on a grant.

## 5. Placeholders and open items

Placeholders are in ALL CAPS in brackets, highlighted yellow.

- Policy: `[INSERT GO-LIVE DATE.]`, `[INSERT RECORD RETENTION PERIOD.]`
- Tracker only: `[INSERT NEXT REVIEW DATE.]`, `[INSERT POLICY TAB LINK.]`, `[CONFIRM WHAT P4 SUPERSEDES.]`

Open or unverified:

- The federal basis of the $5,000 equipment rule (Max's decision, P-044). Check it against the award terms.
- The policy is a draft: Max has not approved it. When he does, remove "(Draft)" from the header document name, set the tracker status, and fill the placeholders.
- Page layout was checked in LibreOffice, not in Word.
- Version "R1" and the tracker owner were chosen by Claude.
- The Clarus theme was not applied to the tracker (see section 1).

## 6. How the Word document was built

The Master Template is a `.dotx`. The build script (`tools/build_policy_docx.py`) does only what the brand skill permits:

- Changes the main document content type in `[Content_Types].xml` from the template type to the document type.
- Replaces the body, the header text `Document Name Here` (with "P4 Purchasing Policy (Draft)") and `Month dd, yyyy` (with "November 24, 2026").
- Keeps the template's `sectPr`, `styles.xml`, theme, settings, footer, numbering, font table, media and relationships unchanged. It was checked byte for byte against the template. The only dropped part is a stray `[trash]/0000.dat` that no relationship uses.

Run it with: `python3 tools/build_policy_docx.py <master template .dotx> <output .docx>`. The policy text is in the script, as a list of calls (`h1`, `p`, `bullet`, `table`), so a new policy is a copy of the script with new content.

Template facts that matter:

- Styles available: Title, Subtitle (all caps by style), Heading 1, Heading 2, Heading 3, Normal (justified Arial 11, with contextual spacing), List Paragraph (bullets). Heading 1 is bold, 14 pt and underlined.
- **Headings in the template are numbered automatically** ("1.", "1A."). To keep them unnumbered, each heading paragraph carries direct formatting: `numPr` with `numId` 0, and an indent of 0. Cross-references use the section name, not a number.
- Two paragraphs in a row in Normal style touch each other. The script adds `contextualSpacing` off to plain body paragraphs so they have a gap.
- Bullets are List Paragraph paragraphs. Bold lead-ins are bold runs. Placeholders are yellow-highlighted runs.
- Tables use the Clarus table style as direct table formatting: white header row with bold black Arial and a 2 pt purple (#6741A0) bottom border, 1 pt purple lines on every cell edge, then lavender (#E1D9EC) and white banding from the first data row, left aligned. Cell paragraphs have `keepNext` so small tables stay on one page. The long appendix table may break across pages, with the header row repeated.
- Appendix A follows the last section directly (no page break), which kept the policy at four pages.

Checks done before delivery:

1. `scripts/office/validate.py` from the docx skill passed (it needs `defusedxml` and `lxml`).
2. Rendered to PDF with LibreOffice and viewed every page as an image.
3. Compared the package with the template (styles, theme, settings, footer, section properties identical; header differs only in the name and date).

## 7. How the tracker was built

`tools/build_tracker.py` (needs `openpyxl` and `Pillow`, installed in a venv because the system Python lacked them). It follows the brand skill's Excel rules:

- Sheet header block: horizontal logo at the top left (52 px tall), title in bold Arial 18 charcoal (#374151), subtitle in Arial 11 slate (#64748B), a 4-point accent bar across the table width cycling purple, blue, teal, slate, orange, green, then three Arial 9 note lines. The third note is a formula, so the counts update by themselves.
- Table: Clarus table style, Arial 10, wrapped text and top alignment, header row frozen (row 9), filters on, 30 formatted rows.
- Columns: Policy number, Policy title, Version, Status, Effective date, Next review date, Approved by, Policy owner, Applies to, Where it is posted, Supersedes, Related SOP or form, Notes.
- Status list: Draft, Under review, In effect, Superseded, Retired. Colors (bold): Draft and Under review orange #F28C28, In effect teal #159A8C, Superseded and Retired slate #64748B.
- Print: landscape, fit to one page wide, header row repeated. The workbook recalculates on open.
- Placeholder cells are filled yellow.
- Run it with: `python3 tools/build_tracker.py <horizontal logo .png> <output .xlsx>`. The P4 row is in the script (`P4`); to add policies, add rows to the finished workbook or extend the script.
- The logo was supplied as a pasted image (WebP, 2000 by 621) and saved as PNG without other changes. Ask for the original PNG if the exact file matters.

## 8. How to write the next policy (suggested steps)

1. Read the example P3 and P4 files and `docs/DECISIONS.md` P-063. Read any existing draft of the new policy.
2. Use the iterative-workshop process: ask only the questions that change the result, give a recommendation with each, and wait for a yes before drafting.
3. Settle: the number and title, what it supersedes, who approves, who it applies to, the rules (never invent a number, deadline or rule), what the document must not say, and what is a placeholder.
4. Write the content as the list of sections in `build_policy_docx.py` (title, subtitle, header table, headings, paragraphs, bullets, tables, appendix). Change `DOC_NAME` and `DOC_DATE`.
5. Build, validate, render to PDF, view every page, and compare with the template as in section 6.
6. Add or update the tracker row. Do not guess dates or links: use placeholders.
7. Send the files and the page images. Never post to SharePoint without Max's say-so, and never overwrite anything in `05_Templates`.

## 9. Environment notes

- Writing to Microsoft 365 through the connector is off by default in the Purchase Request App project. Max gave a one-time exception for filing the app package and the Folder Map, which does not extend to other work.
- The connector reads Word, PDF, Excel and text files, and cannot download `.dotx` or `.thmx`.
- No em dashes in any document. Plain, direct language.
