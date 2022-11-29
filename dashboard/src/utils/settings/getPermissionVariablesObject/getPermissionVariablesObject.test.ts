import type { CustomClaim } from '@/types/application';
import getPermissionVariablesObject from './getPermissionVariablesObject';

test('should convert permission variable object to array', () => {
  const permissionVariables: CustomClaim[] = [
    { key: 'variable-1', value: 'value-1' },
    { key: 'variable-2', value: '2' },
  ];

  expect(getPermissionVariablesObject(permissionVariables)).toEqual({
    'variable-1': 'value-1',
    'variable-2': '2',
  });
});

test('should return an empty object if no permission variables are provided', () => {
  expect(getPermissionVariablesObject()).toEqual({});
  expect(getPermissionVariablesObject(null)).toEqual({});
  expect(getPermissionVariablesObject(undefined)).toEqual({});
  expect(getPermissionVariablesObject([])).toEqual({});
});
