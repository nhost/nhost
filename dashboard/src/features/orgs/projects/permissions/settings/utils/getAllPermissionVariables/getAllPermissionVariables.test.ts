import type { PermissionVariable } from '@/types/application';
import { expect, test } from 'vitest';
import getAllPermissionVariables from './getAllPermissionVariables';

test('should convert permission variable object to array', () => {
  const permissionVariables: PermissionVariable[] = [
    {
      id: 'variable-1',
      key: 'variable-1',
      value: 'value-1',
    },
    {
      id: 'variable-2',
      key: 'variable-2',
      value: '2',
    },
  ];

  expect(getAllPermissionVariables(permissionVariables)).toEqual([
    { id: 'User-Id', key: 'User-Id', value: 'id', isSystemVariable: true },
    { id: 'variable-1', key: 'variable-1', value: 'value-1' },
    { id: 'variable-2', key: 'variable-2', value: '2' },
  ]);
});

test('should only return system variables if no permission variables are provided', () => {
  const systemVariables = [
    { id: 'User-Id', key: 'User-Id', value: 'id', isSystemVariable: true },
  ];

  expect(getAllPermissionVariables()).toEqual(systemVariables);
  expect(getAllPermissionVariables(null)).toEqual(systemVariables);
  expect(getAllPermissionVariables(undefined)).toEqual(systemVariables);
});
