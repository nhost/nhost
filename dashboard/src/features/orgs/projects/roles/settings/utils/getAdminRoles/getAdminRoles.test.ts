import { expect, test } from 'vitest';
import getAdminRoles from './getAdminRoles';

test('should return an array with the admin roles if no roles are passed', () => {
  expect(getAdminRoles()).toEqual(['admin', 'public']);
  expect(getAdminRoles(null)).toEqual(['admin', 'public']);
  expect(getAdminRoles(undefined)).toEqual(['admin', 'public']);
});

test('should return an array with the admin roles and the given roles', () => {
  expect(getAdminRoles(['anonymous', 'me', 'user'])).toEqual([
    'admin',
    'public',
    'anonymous',
    'me',
    'user',
  ]);
});

test('should return an array with the admin roles and the given roles without duplicates', () => {
  expect(getAdminRoles(['anonymous', 'me', 'user', 'admin'])).toEqual([
    'admin',
    'public',
    'anonymous',
    'me',
    'user',
  ]);
});
