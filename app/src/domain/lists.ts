// The fixed choice lists: categories (D-020, D-023), payment types (D-024, D-051)
// and trip purposes (D-050). This is the only place these lists are defined.

import { CategoryId, PaymentTypeId, TripPurposeId } from './types';

/** Longest text a one-line field holds (a SharePoint single-line text column). */
export const TEXT_MAX_LENGTH = 255;

export interface Category {
  id: CategoryId;
  label: string;
  covers: string;
  suggestedAccount: string;
}

export const CATEGORIES: readonly Category[] = [
  { id: 'airfare', label: 'Airfare', covers: 'Tickets, airline baggage and seat fees', suggestedAccount: '6101 Airfare' },
  { id: 'lodging', label: 'Lodging', covers: 'Hotels, short-term rentals', suggestedAccount: '6102 Lodging' },
  { id: 'meals', label: 'Meals', covers: 'Meals while travelling, alone or with other Clarus staff', suggestedAccount: '6103 Meals' },
  {
    id: 'businessMeal',
    label: 'Business meal with guests',
    covers: 'Meals with non-Clarus guests (customers, partners)',
    suggestedAccount: '6220 Business Meals'
  },
  {
    id: 'transportation',
    label: 'Transportation',
    covers: 'Taxi, rideshare, train, bus, rental car, fuel, parking, tolls',
    suggestedAccount: '6104 Transportation'
  },
  {
    id: 'registration',
    label: 'Registration and conferences',
    covers: 'Event and conference registration',
    suggestedAccount: '6105 Seminars, Training, Conferences'
  },
  { id: 'otherTravel', label: 'Other travel', covers: 'Travel costs that fit none of the above', suggestedAccount: '6100 Travel' }
];

export interface PaymentType {
  id: PaymentTypeId;
  label: string;
  shortLabel: string;
  reimbursable: boolean;
  /** QuickBooks account the money came from, when it is known (D-051). */
  suggestedPaymentAccount: string;
}

export const PAYMENT_TYPES: readonly PaymentType[] = [
  { id: 'personal', label: 'Personal card or cash (reimburse me)', shortLabel: 'Personal', reimbursable: true, suggestedPaymentAccount: '' },
  { id: 'companyCard', label: 'Company card', shortLabel: 'Company card', reimbursable: false, suggestedPaymentAccount: 'Credit Cards' },
  { id: 'paidByClarus', label: 'Paid directly by Clarus', shortLabel: 'Paid by Clarus', reimbursable: false, suggestedPaymentAccount: '' }
];

export interface TripPurpose {
  id: TripPurposeId;
  label: string;
  suggestedClass: string;
}

// Employees are never offered 3.0 Other Income or 9.0 Unallowable Expenses (D-050).
export const TRIP_PURPOSES: readonly TripPurpose[] = [
  { id: 'nsfPhase1', label: 'NSF Phase I project work', suggestedClass: '1.01 NSF Phase 1 SBIR' },
  { id: 'xCompetition', label: 'X Competition', suggestedClass: '1.02 X Competition' },
  { id: 'commercial', label: 'Customer or commercial work', suggestedClass: '2.0 Commercial' },
  { id: 'internalRnd', label: 'Internal research and development', suggestedClass: '5.0 Internal R&D' },
  { id: 'generalBusiness', label: 'General company business', suggestedClass: '8.0 Indirect Expenses' },
  { id: 'notSure', label: 'Not sure', suggestedClass: '' }
];

export function findCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function findPaymentType(id: string): PaymentType | undefined {
  return PAYMENT_TYPES.find((p) => p.id === id);
}

export function findTripPurpose(id: string): TripPurpose | undefined {
  return TRIP_PURPOSES.find((t) => t.id === id);
}
