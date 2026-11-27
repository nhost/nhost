import getAdminRoles from './getAdminRoles';

it('should return an array with the default admin roles if no roles are passed', () => {
  expect(getAdminRoles()).toEqual(['admin', 'public', 'anonymous']);
  expect(getAdminRoles(null)).toEqual(['admin', 'public', 'anonymous']);
  expect(getAdminRoles(undefined)).toEqual(['admin', 'public', 'anonymous']);
});

it('should return an array with the admin roles and the given roles', () => {
  expect(getAdminRoles(['anonymous', 'me', 'user', 'test_user'])).toEqual([
    'admin',
    'public',
    'anonymous',
    'me',
    'user',
    'test_user',
  ]);
});

it('should return an array with the admin roles and the given roles without duplicates', () => {
  expect(getAdminRoles(['anonymous', 'me', 'user', 'admin'])).toEqual([
    'admin',
    'public',
    'anonymous',
    'me',
    'user',
  ]);
});
