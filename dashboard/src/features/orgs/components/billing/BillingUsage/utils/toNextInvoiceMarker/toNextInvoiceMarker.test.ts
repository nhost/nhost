import toNextInvoiceMarker from './toNextInvoiceMarker';

describe('toNextInvoiceMarker', () => {
  it('marks a renewal at midnight with its day', () => {
    const marker = toNextInvoiceMarker('2026-12-01T00:00:00.000Z', 'UTC');

    expect(new Date(marker.value).toISOString()).toBe(
      '2026-12-01T00:00:00.000Z',
    );
    expect(marker.label).toBe('Next invoice · Dec 1');
  });

  it('marks a renewal during the day at the next midnight, with its time', () => {
    const marker = toNextInvoiceMarker(
      '2026-12-01T00:00:00.000Z',
      'America/Los_Angeles',
    );

    expect(new Date(marker.value).toISOString()).toBe(
      '2026-12-01T08:00:00.000Z',
    );
    expect(marker.label).toBe('Next invoice · Nov 30, 4:00 PM');
  });
});
