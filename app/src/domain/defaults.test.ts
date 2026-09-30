import {
  defaultPaymentType,
  destinationSuggestions,
  knownVendorName,
  suggestCategoryForVendor,
  suggestPaymentTypeForVendor,
  vendorKey,
  vendorSuggestions
} from './defaults';
import { line, report } from '../testing/builders';

describe('defaults (D-057)', () => {
  it('starts a report with Company card, then copies the row above', () => {
    expect(defaultPaymentType([])).toBe('companyCard');
    expect(defaultPaymentType([line({ rowNumber: 1, paymentType: 'personal' })])).toBe('personal');
    expect(defaultPaymentType([line({ id: 'a', rowNumber: 2, paymentType: 'paidByClarus' }), line({ id: 'b', rowNumber: 1, paymentType: 'personal' })])).toBe(
      'paidByClarus'
    );
    expect(defaultPaymentType([line({ rowNumber: 1, paymentType: '' })])).toBe('companyCard');
  });

  it('suggests the category last used for the same vendor', () => {
    const history = [
      line({ id: 'a', vendor: 'Skyway Airlines', category: 'otherTravel' }),
      line({ id: 'b', vendor: ' skyway  airlines ', category: 'airfare' })
    ];
    expect(suggestCategoryForVendor('SKYWAY AIRLINES', history)).toBe('airfare');
    expect(suggestCategoryForVendor('New Vendor', history)).toBeUndefined();
    expect(suggestCategoryForVendor('', history)).toBeUndefined();
  });

  it('matches vendors whatever their capitals, spaces and punctuation', () => {
    expect(vendorKey(" Joe's  Diner, Inc. ")).toBe('joes diner inc');
    const history = [line({ id: 'a', vendor: 'City Cab Co.', category: 'transportation', paymentType: 'personal' })];
    expect(suggestCategoryForVendor('CITY CAB CO', history)).toBe('transportation');
    expect(suggestPaymentTypeForVendor('city cab co', history)).toBe('personal');
    expect(knownVendorName('CITY CAB CO', history)).toBe('City Cab Co.');
    expect(knownVendorName('Other Cab', history)).toBeUndefined();
  });

  it('lists vendors and destinations most used first, without duplicates', () => {
    const history = [
      line({ id: 'a', vendor: 'City Cab' }),
      line({ id: 'b', vendor: 'Skyway' }),
      line({ id: 'c', vendor: 'city cab' }),
      line({ id: 'd', vendor: '' })
    ];
    expect(vendorSuggestions(history)).toEqual(['City Cab', 'Skyway']);
    expect(
      destinationSuggestions([report({ destination: 'Boston, MA' }), report({ destination: 'Denver, CO' }), report({ destination: 'Boston, MA' })])
    ).toEqual(['Boston, MA', 'Denver, CO']);
  });
});
