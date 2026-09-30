import {
  defaultPaidBy,
  departmentSuggestions,
  knownVendorName,
  latestDepartment,
  suggestCategoryForVendor,
  suggestPaidByForVendor,
  vendorSuggestions
} from './defaults';
import { vendorKey } from './purchaseRules';
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
    expect(vendorKey(" Joe's  Diner, Inc. ")).toBe('joes diner inc');
    const history = [line({ id: 'a', vendor: 'Blue Fern Web Co.', category: 'advertising', paidBy: 'employee' })];
    expect(suggestCategoryForVendor('BLUE FERN WEB CO', history)).toBe('advertising');
    expect(suggestPaidByForVendor('blue fern web co', history)).toBe('employee');
    expect(knownVendorName('BLUE FERN WEB CO', history)).toBe('Blue Fern Web Co.');
    expect(knownVendorName('Other Co', history)).toBeUndefined();
  });

  it('lists vendors most used first, without duplicates', () => {
    const history = [
      line({ id: 'a', vendor: 'Acme' }),
      line({ id: 'b', vendor: 'Borealis' }),
      line({ id: 'c', vendor: 'acme' }),
      line({ id: 'd', vendor: '' })
    ];
    expect(vendorSuggestions(history)).toEqual(['Acme', 'Borealis']);
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
  });
});
