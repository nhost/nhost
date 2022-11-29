import getPermissionVariablesArray from './getPermissionVariablesArray';

test('should convert permission variable object to array', () => {
  const permissionVariables = {
    'variable-1': 'value-1',
    'variable-2': 2,
  };

  expect(getPermissionVariablesArray(permissionVariables)).toEqual([
    { key: 'User-Id', value: 'id', isSystemClaim: true },
    { key: 'variable-1', value: 'value-1' },
    { key: 'variable-2', value: 2 },
  ]);
});

test('should only return system variables if no permission variables are provided', () => {
  const systemVariables = [
    { key: 'User-Id', value: 'id', isSystemClaim: true },
  ];

  expect(getPermissionVariablesArray()).toEqual(systemVariables);
  expect(getPermissionVariablesArray(null)).toEqual(systemVariables);
  expect(getPermissionVariablesArray(undefined)).toEqual(systemVariables);
  expect(getPermissionVariablesArray({})).toEqual(systemVariables);
});
