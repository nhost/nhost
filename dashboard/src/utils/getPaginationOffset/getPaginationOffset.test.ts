import getPaginationOffset from './getPaginationOffset';

describe('getPaginationOffset', () => {
  it('returns 0 for the first page', () => {
    expect(getPaginationOffset(1, 25)).toBe(0);
  });

  it('multiplies (page - 1) by the page size for later pages', () => {
    expect(getPaginationOffset(2, 25)).toBe(25);
    expect(getPaginationOffset(3, 25)).toBe(50);
  });

  it('respects different page sizes', () => {
    expect(getPaginationOffset(2, 10)).toBe(10);
    expect(getPaginationOffset(4, 10)).toBe(30);
  });

  it('clamps page numbers below 1 to the first page', () => {
    expect(getPaginationOffset(0, 25)).toBe(0);
    expect(getPaginationOffset(-3, 25)).toBe(0);
  });
});
