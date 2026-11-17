import {
  NO_QUOTE_REASONS,
  NO_RECEIPT_REASONS,
  defaultPaidBy,
  departmentSuggestions,
  knownVendorName,
  latestDepartment,
  suggestCategoryForVendor,
  suggestPaidByForVendor,
  vendorSuggestions
} from './defaults';
import { NO_QUOTE_REASONS as POLICY_NO_QUOTE_REASONS, NO_RECEIPT_REASONS as POLICY_NO_RECEIPT_REASONS, vendorKey } from './purchaseRules';
import { line, request } from '../testing/builders';

describe('defaults (travel D-057, P-023)', () => {
  it('starts a request with Company, then copies the row above', () => {
    expect(defaultPaidBy([])).toBe('company');
    expect(defaultPaidBy([line({ rowNumber: 1, paidBy: 'employee' })])).toBe('employee');
    expect(defaultPaidBy([line({ id: 'a', rowNumber: 2, paidBy: 'company' }), line({ id: 'b', rowNumber: 1, paidBy: 'employee' })])).toBe('company');
    expect(defaultPaidBy([line({ rowNumber: 1, paidBy: '' })])).toBe('company');
  });

  it('suggests the category last used for the same vendor', () => {
    const history = [
      line({ id: 'a', vendor: 'Acme Lab Supply', category: 'office' }),
      line({ id: 'b', vendor: ' acme  lab supply ', category: 'rdMaterials' })
    ];
    expect(suggestCategoryForVendor('ACME LAB SUPPLY', history)).toBe('rdMaterials');
    expect(suggestCategoryForVendor('New Vendor', history)).toBeUndefined();
    expect(suggestCategoryForVendor('', history)).toBeUndefined();
  });

  it('matches vendors whatever their capitals, spaces and punctuation', () => {
    expect(vendorKey(" Joe's  Diner, Inc. ")).toBe('joesdinerinc');
    const history = [line({ id: 'a', vendor: 'Blue Fern Web Co.', category: 'advertising', paidBy: 'employee' })];
    expect(suggestCategoryForVendor('BLUE FERN WEB CO', history)).toBe('advertising');
    expect(suggestPaidByForVendor('blue fern web co', history)).toBe('employee');
    expect(suggestCategoryForVendor('BlueFern WebCo', history)).toBe('advertising');
    expect(knownVendorName('BLUE FERN WEB CO', history)).toBe('Blue Fern Web Co.');
    expect(knownVendorName('Other Co', history)).toBeUndefined();
  });

  it('lists vendors most used first, without duplicates, counting the spellings of one vendor together', () => {
    const history = [
      line({ id: 'a', vendor: 'Acme' }),
      line({ id: 'b', vendor: 'Borealis' }),
      line({ id: 'c', vendor: 'acme' }),
      line({ id: 'd', vendor: '' }),
      line({ id: 'e', vendor: 'Digi-Key' }),
      line({ id: 'f', vendor: 'DigiKey' }),
      line({ id: 'g', vendor: 'DIGI KEY' })
    ];
    expect(vendorSuggestions(history)).toEqual(['Digi-Key', 'Acme', 'Borealis']);
  });

  it('offers the canned reasons from the policy file (P-004)', () => {
    expect(NO_QUOTE_REASONS).toBe(POLICY_NO_QUOTE_REASONS);
    expect(NO_RECEIPT_REASONS).toBe(POLICY_NO_RECEIPT_REASONS);
  });

  it('suggests departments most used first, and fills a new request from the latest one (P-022)', () => {
    const requests = [
      request({ id: 1, department: 'R&D', lastChanged: '2026-08-01 10:00' }),
      request({ id: 2, department: 'Operations', lastChanged: '2026-09-20 10:00' }),
      request({ id: 3, department: 'r&d', lastChanged: '2026-07-01 10:00' }),
      request({ id: 4, department: '', lastChanged: '2026-10-01 10:00' })
    ];
    expect(departmentSuggestions(requests)).toEqual(['R&D', 'Operations']);
    expect(latestDepartment(requests)).toBe('Operations');
    expect(latestDepartment([])).toBe('');
    // Two requests changed in the same minute: the newer one (higher ID) wins.
    expect(
      latestDepartment([
        request({ id: 5, department: 'Older', lastChanged: '2026-10-01 10:00' }),
        request({ id: 6, department: 'Newer', lastChanged: '2026-10-01 10:00' })
      ])
    ).toBe('Newer');
  });
});
