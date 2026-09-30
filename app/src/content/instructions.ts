// The employee instructions (SOP Part A, D-036). The Instructions panel shows
// this text, and docs/SOP.md Part A is generated from it ("npm run sop"); a
// test fails if the two differ. O20 (wording for non-travel purchases until
// the Purchase Request App exists) is still open.

import { CATEGORIES, PAYMENT_TYPES } from '../domain/lists';
import { rateText } from '../domain/mileage';
import { formatCents } from '../domain/money';
import { DAILY_MEAL_LIMIT_CENTS, MILEAGE_CENTS_PER_MILE } from '../domain/rates';

// The latest rates in the tables (D-072). A rate change changes this text, and
// the SOP check then asks for "npm run sop".
const MEAL_LIMIT = formatCents(DAILY_MEAL_LIMIT_CENTS[DAILY_MEAL_LIMIT_CENTS.length - 1].value);
const MILEAGE_RATE = rateText(MILEAGE_CENTS_PER_MILE[MILEAGE_CENTS_PER_MILE.length - 1].value);

export interface InstructionSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export const INSTRUCTIONS: InstructionSection[] = [
  {
    heading: 'What goes in a travel report',
    paragraphs: [
      'All travel costs of one trip, including those paid before or after it: airfare, lodging, ground transportation, fuel, parking and tolls, meals while travelling, event registration, and baggage and travel fees.',
      'Materials and supplies do not belong here, even if you bought them for the trip (printing, posters, store purchases, equipment). Use the Purchase Request App for those.'
    ]
  },
  {
    heading: 'Starting a report',
    bullets: [
      'Click New report and fill in the trip details: trip name, destination, dates, business purpose and what the trip was for.',
      'Not sure what the trip was for? Choose "Not sure". The administrator will decide.',
      'Everything saves automatically. You can leave and come back.'
    ]
  },
  {
    heading: 'Adding receipts and expenses',
    bullets: [
      'On the Expenses step, drop all your receipts into the box at once (PDF, JPG, PNG or HEIC, up to 15 MB each). Each receipt becomes a row.',
      'The app reads each receipt and fills in the date, amount and vendor it finds. For a vendor you have used before, typed or read, it also fills in the category and how you paid last time. Values taken from the receipt, and a "Paid with" changed this way, are highlighted: check each one against the receipt, correct anything wrong, then click Confirm on the row. A row with highlighted values cannot be submitted until you confirm it.',
      'The app only fills in empty boxes: anything you typed stays as you typed it. Unclear photos and HEIC files are not read; type those rows yourself. Receipts are read on your own computer; nothing is sent anywhere else to read them.',
      'Fill in or check each row: date, vendor, category, amount and how it was paid. Press Enter to move down a column. Ctrl+D copies the value from the row above.',
      'One receipt for several expenses (for example a hotel bill with room and restaurant charges)? Add a row for each expense, then use the row menu (the three dots) and choose "Same receipt as row".',
      'Two files for one expense (for example an itemized receipt and the card slip)? Use the row menu and choose "Add another file".',
      'Drove your own car? On Trip details, turn on "I drove my own car". Then on Expenses, add each drive: date, from, to and miles (a round trip is one drive with the total miles). The app works out the amount at the GSA rate. No receipt is needed.'
    ]
  },
  {
    heading: 'Categories',
    bullets: CATEGORIES.map((c) => `${c.label}: ${c.covers}.`)
  },
  {
    heading: 'How it was paid',
    bullets: [
      ...PAYMENT_TYPES.map((p) => `${p.label}: ${p.reimbursable ? 'you will be reimbursed' : 'not reimbursed to you'}.`),
      'If the administrator booked something for you (for example a flight), add it as "Paid directly by Clarus" and attach the confirmation.'
    ]
  },
  {
    heading: 'Shared costs',
    paragraphs: ['The person whose card paid reports the expense, even if it covered other people too.']
  },
  {
    heading: 'No receipt?',
    paragraphs: ['Add the expense with "Add expense without receipt" and say why there is no receipt. The administrator will see the reason.']
  },
  {
    heading: 'Travel policy reminders',
    bullets: [
      `Meals: the limit is ${MEAL_LIMIT} a day, the GSA standard per diem for meals and incidentals, the same every day of the trip. The app flags a day that is over it, or on track to be: for example one $30 meal, which at that rate would make about $90 for three meals. A flag does not stop you submitting; the administrator sees it.`,
      'Receipts: itemized receipts are needed for lodging, airfare, rental cars, other ground transportation and meals, and for any other single expense over $25.',
      'Not reimbursed: alcoholic drinks, entertainment, personal items (such as toiletries or souvenirs), and traffic fines or parking tickets.',
      'Airfare is economy or coach. Rental cars are compact or intermediate size, unless there is a documented reason.',
      `Mileage in your own car is paid at the GSA rate (now ${MILEAGE_RATE}). Driving between home and your usual workplace is commuting and is not paid.`
    ]
  },
  {
    heading: 'What this app does not cover yet',
    bullets: [
      'Per diem allowances: enter what meals actually cost, with receipts.',
      'Foreign currency: enter the dollar amount from your card or bank statement, and note the foreign amount in the description.'
    ]
  },
  {
    heading: 'Submitting',
    bullets: [
      'Submit within 30 days after the trip ends, as the travel policy asks. A later report can still be submitted; it is marked as late for the administrator.',
      'On Review and submit, fix anything marked in red, and confirm any rows the app filled in. Amber items are warnings: check them, but you can still submit.',
      'To submit, tick the certification that the expenses were for official business, follow the travel policy and are accurate. It is recorded with your account; no signature is needed.',
      'After you submit, the report is locked. The administrator is emailed and a folder with your receipts is created for processing.',
      'If the administrator returns the report, you will see their note. Correct it and submit again.'
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
