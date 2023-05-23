import { describe, expect, test } from 'vitest';
import getInputType from './getInputType';

describe('getInputType', () => {
  test('should return "number" if the column is numeric', () => {
    expect(getInputType({ type: 'number' })).toBe('number');
    expect(getInputType({ type: 'number', specificType: 'numeric' })).toBe(
      'number',
    );
    expect(getInputType({ type: 'number', specificType: 'int' })).toBe(
      'number',
    );
    expect(getInputType({ type: 'number', specificType: 'int4' })).toBe(
      'number',
    );
  });

  test('should return "text" if the column is text based', () => {
    expect(getInputType({ type: 'text', specificType: 'text' })).toBe('text');
    expect(getInputType({ type: 'text', specificType: 'varchar' })).toBe(
      'text',
    );
    expect(getInputType({ type: 'text', specificType: 'bpchar' })).toBe('text');
  });

  test('should return "date" if the column has "date" type, but not time', () => {
    expect(getInputType({ type: 'date' })).toBe('date');
    expect(getInputType({ type: 'date', specificType: 'time' })).not.toBe(
      'date',
    );
  });

  test('should return "datetime-local" if the column has a "datetime" type, but not time', () => {
    expect(getInputType({ type: 'date', specificType: 'timestamp' })).toBe(
      'datetime-local',
    );
    expect(getInputType({ type: 'date', specificType: 'timestamptz' })).toBe(
      'datetime-local',
    );
    expect(getInputType({ type: 'date', specificType: 'time' })).not.toBe(
      'date',
    );
  });

  test('should return "time" if the column has a "time" type', () => {
    expect(getInputType({ type: 'date', specificType: 'time' })).toBe('time');
    expect(getInputType({ type: 'date', specificType: 'timetz' })).toBe('time');
  });
});
