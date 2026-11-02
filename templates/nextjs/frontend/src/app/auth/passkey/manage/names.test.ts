import { describe, expect, it } from 'vitest';
import { unusedName } from '@/app/auth/passkey/manage/names';

describe('unusedName', () => {
  it('numbers a taken name from 2, past the numbers already used', () => {
    expect(unusedName('Chrome - macOS', ['Chrome - macOS'])).toBe(
      'Chrome - macOS 2',
    );
    expect(
      unusedName('Chrome - macOS', ['Chrome - macOS', 'Chrome - macOS 2']),
    ).toBe('Chrome - macOS 3');
  });
});
