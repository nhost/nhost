import { describe, expect, test } from 'vitest';
import { formatFormDateValue } from './EditRecordForm';

describe('formatFormDateValue', () => {
  test('returns null or undefined as-is', () => {
    expect(formatFormDateValue(null)).toBeNull();
    expect(formatFormDateValue(undefined)).toBeUndefined();
  });

  test('formats date string values directly by regex matching to avoid timezone shift', () => {
    // Standard ISO date string should be truncated directly
    expect(formatFormDateValue('2023-11-23', 'date')).toBe('2023-11-23');
    expect(formatFormDateValue('2023-11-23T00:00:00.000Z', 'date')).toBe('2023-11-23');
  });

  test('formats Date objects timezone-agnostically for date type using UTC methods', () => {
    // A Date object initialized in UTC representing 23rd Nov
    const date = new Date('2023-11-23T00:00:00.000Z');
    expect(formatFormDateValue(date, 'date')).toBe('2023-11-23');
  });

  test('formats timestamps using local time methods', () => {
    // For timestamp, we expect local date formatting. We mock/use a date and check format.
    const dateStr = '2023-11-23T15:30:00.000Z';
    const date = new Date(dateStr);
    const expectedYear = date.getFullYear();
    const expectedMonth = String(date.getMonth() + 1).padStart(2, '0');
    const expectedDay = String(date.getDate()).padStart(2, '0');
    const expectedHours = String(date.getHours()).padStart(2, '0');
    const expectedMinutes = String(date.getMinutes()).padStart(2, '0');

    expect(formatFormDateValue(dateStr, 'timestamp')).toBe(
      `${expectedYear}-${expectedMonth}-${expectedDay}T${expectedHours}:${expectedMinutes}`
    );
  });

  test('formats time values using local time', () => {
    const dateStr = '2023-11-23T15:30:00.000Z';
    const date = new Date(dateStr);
    const expectedHours = String(date.getHours()).padStart(2, '0');
    const expectedMinutes = String(date.getMinutes()).padStart(2, '0');

    expect(formatFormDateValue(dateStr, 'time')).toBe(
      `${expectedHours}:${expectedMinutes}`
    );
  });
});
