import { QUANTITY_MAX, normalizeQuantity, parseQuantityText } from './quantity';

describe('the quantity of a row', () => {
  it('is a whole number from 1 to the largest allowed, whatever was stored', () => {
    expect(normalizeQuantity(2)).toBe(2);
    expect(normalizeQuantity('3')).toBe(3);
    expect(normalizeQuantity(2.6)).toBe(3);
    expect(normalizeQuantity(QUANTITY_MAX)).toBe(QUANTITY_MAX);
  });

  it('reads anything else as 1 or as the nearest limit', () => {
    for (const bad of [null, undefined, '', 'many', NaN, Infinity, {}, [], true]) expect(normalizeQuantity(bad)).toBe(1);
    expect(normalizeQuantity(0)).toBe(1);
    expect(normalizeQuantity(-4)).toBe(1);
    expect(normalizeQuantity(QUANTITY_MAX + 1)).toBe(QUANTITY_MAX);
    expect(normalizeQuantity(1e9)).toBe(QUANTITY_MAX);
  });

  it('reads a typed quantity only when it is a whole number from 1 to the largest allowed', () => {
    expect(parseQuantityText('2')).toBe(2);
    expect(parseQuantityText(' 12 ')).toBe(12);
    expect(parseQuantityText('0012')).toBe(12);
    for (const bad of ['', ' ', '0', '-1', '1.5', '2x', 'two', '1e3', String(QUANTITY_MAX + 1), '12345']) expect(parseQuantityText(bad)).toBeNull();
  });
});
