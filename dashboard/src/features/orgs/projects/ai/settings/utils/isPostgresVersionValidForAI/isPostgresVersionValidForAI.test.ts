import { vi } from 'vitest';

import isPostgresVersionValidForAI from './isPostgresVersionValidForAI';

beforeEach(() => {
  vi.resetModules();
});

it('greater than minimum version, minor version with two digits, should be valid', () => {
  const postgresVersion = '14.11-20240515-1';
  expect(isPostgresVersionValidForAI(postgresVersion)).toBe(true);
});

it('less than minimum version, should be invalid', () => {
  const postgresVersion = '14.6-20221110-1';
  expect(isPostgresVersionValidForAI(postgresVersion)).toBe(false);
});

it('equal to minimum version, should be valid', () => {
  const postgresVersion = '14.6-20231018-1';
  expect(isPostgresVersionValidForAI(postgresVersion)).toBe(true);
});
