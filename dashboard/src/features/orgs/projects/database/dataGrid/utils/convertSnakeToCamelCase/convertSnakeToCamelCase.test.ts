import { describe, expect, it } from 'vitest';
import convertSnakeToCamelCase from './convertSnakeToCamelCase';

describe('convertSnakeToCamelCase', () => {
  it('returns an empty string for falsy-ish values', () => {
    expect(convertSnakeToCamelCase()).toBe('');
    expect(convertSnakeToCamelCase(null)).toBe('');
    expect(convertSnakeToCamelCase('')).toBe('');
  });

  it('returns the original value when there are no underscores', () => {
    expect(convertSnakeToCamelCase('userProfile')).toBe('userProfile');
    expect(convertSnakeToCamelCase('UserProfile')).toBe('UserProfile');
  });

  it('converts a simple snake_case string to camelCase', () => {
    expect(convertSnakeToCamelCase('created_at')).toBe('createdAt');
    expect(convertSnakeToCamelCase('insert_user_one')).toBe('insertUserOne');
  });

  it('normalizes uppercase segments while converting', () => {
    expect(convertSnakeToCamelCase('INSERT_USER')).toBe('insertUser');
  });

  it('ignores empty segments caused by repeated underscores', () => {
    expect(convertSnakeToCamelCase('__custom_field__name__')).toBe(
      'customFieldName',
    );
  });
});
