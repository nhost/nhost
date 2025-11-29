import { describe, expect, it } from 'vitest';
import convertToCamelCase from './convertToCamelCase';

describe('convertToCamelCase', () => {
  it('returns an empty string for falsy-ish values', () => {
    expect(convertToCamelCase()).toBe('');
    expect(convertToCamelCase(null)).toBe('');
    expect(convertToCamelCase('')).toBe('');
  });

  it('returns the original value when there are no underscores', () => {
    expect(convertToCamelCase('userProfile')).toBe('userProfile');
    expect(convertToCamelCase('UserProfile')).toBe('UserProfile');
  });

  it('converts a simple snake_case string to camelCase', () => {
    expect(convertToCamelCase('created_at')).toBe('createdAt');
    expect(convertToCamelCase('insert_user_one')).toBe('insertUserOne');
  });

  it('normalizes uppercase segments while converting', () => {
    expect(convertToCamelCase('INSERT_USER')).toBe('insertUser');
  });

  it('ignores empty segments caused by repeated underscores', () => {
    expect(convertToCamelCase('__custom_field__name__')).toBe(
      'customFieldName',
    );
  });
});
