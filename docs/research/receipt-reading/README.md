# Receipt reading: accuracy test (D-074)

**Date:** 2026-09-29. **Purpose:** before building receipt suggestions (D-074, pending change 1), check how well a text reader running inside the browser finds the date, total and vendor on receipts. **Result:** good enough to build, with limits stated below.

**Update, 2026-09-29:** the app now has the reader (D-079). Its rules are `app/src/domain/receiptText.ts`, a TypeScript copy of `parse.mjs` that gives the same answers on all 54 receipts. `app/preview/tools/check-reader.mjs` runs these receipts through the app's own reader in Chromium: 134 of 162 fields right, 0 wrong, 28 left empty, the same as below. The files in this folder stay as the record of the test.

## What was tested

- **Reader:** Tesseract.js 6.0.1 (the Tesseract engine compiled to run in a web page), English data `4.0.0_best_int`, run in Chromium, the engine Microsoft Edge uses. PDFs with a text layer are read directly with PDF.js 4.10.38; PDFs without one are drawn as an image and read.
- **Field guesser:** `parse.mjs`, a first version of the rules the app would use: date in the common US and ISO formats, total from the line labelled Total, Amount due or similar (never Subtotal), vendor from the first name-like line at the top.
- **Receipts:** 54 synthetic receipts, all made up and stamped as test samples. The 6 in `test/fixtures/receipts`, 3 more with till-style layouts (address block, subtotal, tax, other date formats and total labels), and hard versions of all 9: a tilted, blurred phone photo saved as JPEG; faded thermal paper; faded thermal paper with heavy speckle; a small low-resolution image; and a scanned PDF with no text layer.
- **Scoring:** each field right, wrong, or left empty. Vendor counts as right when it matches apart from capitals and punctuation ("City Cab Co" for "City Cab Co.").

## Results

| Kind of receipt | Receipts | Date | Total | Vendor | Time per receipt |
|---|---|---|---|---|---|
| Clean, from the repository | 6 | 6 right | 6 right | 6 right | 0.1 to 0.8 s |
| Clean, till layout | 3 | 3 right | 3 right | 3 right | about 0.5 s |
| Phone photo (tilted, blurred, JPEG) | 9 | 9 right | 9 right | 9 right | about 0.6 s |
| Faded thermal paper | 9 | 9 right | 9 right | 9 right | about 0.5 s |
| Small, low resolution | 9 | 8 right, 1 empty | 9 right | 9 right | about 0.5 s |
| Scanned PDF, no text layer | 9 | 9 right | 9 right | 9 right | about 0.7 s |
| Faded thermal with heavy speckle | 9 | 9 empty | 9 empty | 9 empty | about 1.2 s |
| **All** | **54** | | | | |

Of 162 fields: **134 right, 0 wrong, 28 left empty.** Leaving out the heavy-speckle set: 134 of 135 right, 1 empty, 0 wrong. The one empty date was printed `2026-09-17` and read as `2026-00-17`, which is not a date, so the app would leave it for the employee rather than guess.

The heavy-speckle receipts are barely readable by eye. The reader returns nonsense for them, so the app suggests nothing when the reader reports low confidence (below 45%), and the employee types the details, as today.

**First run, before three rules were added:** 106 of 108 fields right on the non-thermal receipts, 2 empty, 0 wrong. The heavy-speckle receipts got a nonsense vendor 9 times. Three rules were then added and are included above: suggest nothing below 45% confidence; read `$1485` on a total line as $14.85 when the decimal point is lost; join a vendor name that wraps onto a second line. Because these rules were written while looking at these same receipts, the results above are best-case.

## Limits

- **Synthetic receipts only.** They use clear fonts and simple layouts. Real receipts add logos, crumpled paper, shadows, long item lists, cash tendered and change lines, and handwritten tips. Handwriting could not be tested (no handwriting font here). Real-world accuracy will be lower. It is checked with real receipts at Stage 13 on the test site.
- **Suggestions only.** Every suggested value is highlighted until the employee confirms or edits it, and a guess never replaces something the employee typed (D-074).
- **First use on a computer:** the reader's files are downloaded once, then kept by the browser. The time for that download on Clarus's connection is not measured here (this test served the files locally).
- **Size (estimate):** the app package grows from about 0.3 MB to roughly 6 MB compressed (about 12 MB uncompressed): reader engine about 4 MB, English data about 3 MB, PDF.js about 1.7 MB.
- **SharePoint's page security (Unverified):** the reader runs WebAssembly in a background worker. Whether SharePoint Online's content security settings allow this for an SPFx web part has not been checked (Microsoft's documentation is blocked in this environment). The app will be built so that if the reader cannot start, the suggestions simply do not appear and everything else works as now. Checked on the test site at Stage 13.
- **Licences:** Tesseract.js, its engine and PDF.js are Apache-2.0; the English data package is MIT (read from the packages, 2026-09-29).

## How to run it again

From this folder, with the app's dependencies installed (`app/node_modules`, for Playwright) and Chromium at `/opt/pw-browsers/chromium`:

```
npm install
node gen.mjs      # writes the 54 receipts and their answers to work/receipts
node run.mjs      # reads each one in Chromium, prints a line per receipt, writes work/results.json
```

`work/` and `node_modules/` are not committed.
