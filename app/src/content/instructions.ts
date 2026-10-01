// The employee instructions (SOP Part A, travel D-036). The Instructions panel
// shows this text, and docs/SOP.md Part A is generated from it ("npm run sop");
// a test fails if the two differ. Every number and every rule below comes from
// domain/purchaseRules.ts, so a change of policy changes this text and the SOP
// check then asks for "npm run sop".

import {
  APPROVAL_THRESHOLD_TEXT,
  BUYER_OPTIONS,
  CATEGORIES,
  CERTIFICATION,
  OVERRUN_TOLERANCE_PERCENT,
  PAID_BY_OPTIONS,
  PROJECT_QUICK_PICKS,
  QUOTE_THRESHOLD_TEXT
} from '../domain/purchaseRules';

export interface InstructionSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

const QUICK_PICKS = PROJECT_QUICK_PICKS.length > 0 ? ` or click the quick pick (${PROJECT_QUICK_PICKS.map((p) => `"${p}"`).join(', ')})` : '';

export const INSTRUCTIONS: InstructionSection[] = [
  {
    heading: 'What goes in a purchase request',
    paragraphs: [
      'Purchases that are not travel: materials, supplies and equipment, software, website and marketing costs, office supplies, training, shipping and postage, and insurance. One request covers one business purpose and can hold several purchases.',
      'Travel costs (airfare, lodging, meals, ground transportation, registration and travel fees) do not belong here. Use the Travel app for those.',
      'This app replaces the Word purchase request form and posting it in the Purchasing Receipt Team on Teams. The app records the request, the approval and the receipts, so you do not post anything in Teams.'
    ]
  },
  {
    heading: 'Starting a request',
    bullets: [
      'Click New request. On Request details, enter your department and the business purpose in one line, for example "Lab supplies for the Phase 1 assay". The business purpose is also the name of the request.',
      `The project or grant code is optional. Type it${QUICK_PICKS}. Nothing is filled in for you.`,
      `Choose who buys it. ${BUYER_OPTIONS[0].label} is the usual choice and is chosen for you: you say what to buy, and the approver (the site Owners) approves it, buys it and finishes the request. Choose ${BUYER_OPTIONS[1].label} only when you will buy it and submit your own receipts.`,
      'Everything saves automatically. You can leave and come back.'
    ]
  },
  {
    heading: 'When the approver buys it',
    bullets: [
      'On the Purchases step, add one row for each thing to buy: the vendor, what it is and why, an estimated amount, the category, and the web address of the item. Paste the address into "Item link". If there is no web page, say why in the "No web page: say why" box that appears. Nobody is asked who paid: the company pays for what the approver buys.',
      'The date starts as today. It is the day the purchase should be made; the approver sets the actual date when buying.',
      `For a vendor total of ${QUOTE_THRESHOLD_TEXT} or more, attach a quote (drop it into the box, or use the row menu and choose "Attach a quote"), or say why there is none in the "No quote: say why" box on the vendor's first row. You attach no receipt: the approver does that after buying.`,
      'On Review and send, fix anything marked in red, then choose Send to the approver. Every request goes to the approver, whatever the amount. You tick the certification then (see Certification below), because you submit nothing afterwards.',
      'The request is locked and the approver is emailed. Its status is Awaiting approval. If the approver returns it, it shows as Returned with their note. Correct it and send it again.',
      'When it is approved, the approver buys it, attaches the receipt and marks it purchased. You have nothing more to do. The status changes to Purchased and then to Processed.'
    ]
  },
  {
    heading: 'Adding purchases',
    bullets: [
      'On the Purchases step, add one row for each purchase: date, vendor, what was bought and why, category and amount, and who paid when you buy it yourself. Press Enter to move down a column. Ctrl+D copies the value from the row above.',
      'You can paste several rows from a spreadsheet. Put its columns in the order of the grid (date, vendor, what was bought and why, category, amount, and who paid when you buy it yourself), add enough rows first, click the cell where the first value goes, and paste. Write dates like 2026-10-14, 10/14/2026 or Oct 14, 2026, categories as they are named in the list, and amounts like 45.10. A value the app cannot read is not used, and a message says how many there were and why.',
      'Have the files? Drop them into the box at once (PDF, JPG, PNG or HEIC, up to 15 MB each). Each file becomes a row. When you buy it yourself, the switch in the box says whether the files are receipts or invoices, or quotes. When the approver buys it, the box takes quotes only.',
      'When you buy it yourself, the app reads each receipt or invoice and fills in the date, amount and vendor it finds. For a vendor you have used before, typed or read, it also fills in the category and who paid last time. Values taken from the receipt, and a "Who paid" changed this way, are highlighted: check each one against the receipt, correct anything wrong, then click Confirm on the row. A row with highlighted values cannot be sent or submitted until you confirm it.',
      'The app only fills in empty boxes: anything you typed stays as you typed it. Quotes, unclear photos and HEIC files are not read; type those rows yourself. Receipts are read on your own computer; nothing is sent anywhere else to read them.',
      'One receipt for several purchases (for example one invoice for two items)? Add a row for each purchase, then use the row menu (the three dots) and choose "Same receipt as row". A row that holds its own receipt file cannot also use another row\'s.',
      'Another file for a row, such as a quote or a second page? Use the row menu and choose "Attach a receipt or invoice" or "Attach a quote".'
    ]
  },
  {
    heading: 'When you buy it yourself: approval and quotes',
    bullets: [
      `Approval is worked out by vendor within one request. If the purchases from one vendor add up to ${APPROVAL_THRESHOLD_TEXT} or more, you need the approver's approval before you buy. Splitting a purchase across rows does not avoid it. The Vendor totals table on the Purchases step shows each vendor's total and what it needs.`,
      `For a vendor total of ${QUOTE_THRESHOLD_TEXT} or more, attach a quote (drop it as a quote, or use the row menu), or say why there is none in the "No quote: say why" box on the vendor's first row.`,
      'When the request is ready, go to Review and submit and choose Send for approval. The request is locked and the approver (the site Owners) is emailed. Its status is Awaiting approval.',
      'If the approver returns the request, it shows as Returned with their note. Correct it and send it for approval again.',
      'Once it is approved, you can buy. Then attach your receipts and invoices, and submit (see Submitting).',
      `If a vendor total later rises more than ${OVERRUN_TOLERANCE_PERCENT}% above the amount that was approved, or another vendor reaches ${APPROVAL_THRESHOLD_TEXT}, send the request for approval again. A small rise (for example tax or shipping) and any lower amount do not need approval again.`,
      `If every vendor total is under ${APPROVAL_THRESHOLD_TEXT}, no approval is needed. You still submit the request with your receipts.`
    ]
  },
  {
    heading: 'Bought something before approval?',
    bullets: [
      `If you buy it yourself and a purchase of ${APPROVAL_THRESHOLD_TEXT} or more has already been made, you can still send the request for approval. The app flags it as "Bought before approval" when a row is dated before today or already has a receipt or invoice attached.`,
      'The approver and the administrator both see the flag. The approver still has to approve the request, and may return it.',
      'Ask for approval before you buy whenever you can. When the approver buys it, nothing is flagged.'
    ]
  },
  {
    heading: 'Categories',
    paragraphs: [
      'Each category is a QuickBooks account, named exactly as it is in QuickBooks, so your choice is the account. You suggest a category for each row. The approver, when approving, or the administrator can confirm or change it. Equipment and Other have no fixed account: the administrator decides, and confirms them before the request is processed. Choose Other only when nothing fits, and describe the category in the box that appears.'
    ],
    bullets: CATEGORIES.map((c) => `${c.label}: ${c.covers}.`)
  },
  {
    heading: 'Who paid',
    paragraphs: ['You are asked who paid only when you buy it yourself. When the approver buys it, the company pays.'],
    bullets: PAID_BY_OPTIONS.map((p) => `${p.label}: ${p.help}`)
  },
  {
    heading: 'No receipt?',
    paragraphs: [
      'When you buy it yourself, every row needs a receipt or invoice before you submit, or a reason there is none, for example "Receipt lost". Type the reason in the "No receipt: say why" box on the row. A quote is not a receipt. Use "Add purchase without a file" to add a row you will fill in by hand. When the approver buys it, the approver attaches the receipts.'
    ]
  },
  {
    heading: 'Submitting',
    bullets: [
      'This is for a request you buy yourself. When the approver buys it, you send it to the approver and submit nothing.',
      'On Review and submit, fix anything marked in red, and confirm any rows the app filled in. Amber items are warnings: check them, but you can still go on.',
      `To submit, tick the certification: "${CERTIFICATION}" It is recorded with your account; no signature is needed.`,
      'After you submit, the request is locked. The administrator is emailed and a folder with your receipts, quotes and a spreadsheet of the purchases is created for processing.',
      'If the administrator returns the request, you will see their note. Correct it and submit again.'
    ]
  },
  {
    heading: 'Certification',
    paragraphs: [
      `You certify the request with this sentence: "${CERTIFICATION}" It is recorded with your account; no signature is needed. When the approver buys it, you tick it when you send the request to the approver. When you buy it yourself, you tick it when you submit.`
    ]
  },
  {
    heading: 'For the approver: approving and buying',
    bullets: [
      'Under Approvals, "Waiting for approval" lists the requests sent to you, and "To buy" lists the requests you approved that you have not yet marked purchased. You also get an email for each request sent for approval.',
      'Open a request to read it. Item links open the item in a new tab; only a web address that starts with https:// or http:// is a link. Approve confirms the categories shown (change one first if it is wrong) and records every vendor total as approved. Or return it with a note.',
      'To buy it, open the approved request and choose Open to buy. Change each row to what you bought: the vendor, the amount, the date, and extra rows for shipping or tax. The rows as the employee sent them stay on the page. You may spend more than was approved.',
      'Attach the receipt or invoice to each row (row menu, "Attach a receipt or invoice"), or point rows that share one at it ("Same receipt as row"). On Review and mark purchased, choose Mark purchased. A folder with the receipts, the quotes and a spreadsheet is made for the administrator, who is emailed.',
      'If you cannot buy it, return it to the employee with a note from its page. Delete any rows you added first. If the administrator returns it to you after you marked it purchased, fix it and mark it purchased again.',
      'Only the approver who approved a request buys it. Another site Owner can read it, and can return it once it is purchased, but cannot change its rows or mark it purchased.'
    ]
  },
  {
    heading: 'What this app does not cover',
    bullets: [
      'Travel: use the Travel app.',
      'Foreign currency: enter the dollar amount from your card or bank statement, and note the foreign amount in "What was bought and why".'
    ]
  }
];

/** Part A of docs/SOP.md: the same sections as the Instructions panel, as Markdown. */
export function instructionsMarkdown(): string {
  const out: string[] = [];
  for (const section of INSTRUCTIONS) {
    out.push(`### ${section.heading}`, '');
    for (const p of section.paragraphs ?? []) out.push(p, '');
    if (section.bullets) out.push(...section.bullets.map((b) => `- ${b}`), '');
  }
  return out.join('\n').trimEnd() + '\n';
}
