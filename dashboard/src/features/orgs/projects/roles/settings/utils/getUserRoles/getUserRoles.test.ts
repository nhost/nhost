import { expect, test } from 'vitest';
import getUserRoles from './getUserRoles';

test('should return an empty array if no roles are passed', () => {
  expect(getUserRoles()).toEqual([]);
  expect(getUserRoles(null)).toEqual([]);
  expect(getUserRoles(undefined)).toEqual([]);
});

test('should return an array of roles', () => {
  expect(getUserRoles(['test', 'test2', 'test3'])).toEqual([
    { name: 'test', isSystemRole: false },
    { name: 'test2', isSystemRole: false },
    { name: 'test3', isSystemRole: false },
  ]);
});

test('should flag `user` and `me` as system roles', () => {
  expect(getUserRoles(['user', 'me', 'test'])).toEqual([
    { name: 'user', isSystemRole: true },
    { name: 'me', isSystemRole: true },
    { name: 'test', isSystemRole: false },
  ]);
});
