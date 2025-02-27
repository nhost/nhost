import splitPostgresMajorMinorVersions from './splitPostgresMajorMinorVersions';

test('can split a postgres version into major and minor', () => {
  const { major, minor } = splitPostgresMajorMinorVersions('15.10-20250131-1');

  expect(major).toBe('15');
  expect(minor).toBe('10-20250131-1');
});

test('can get major and minor versions from a postgres beta version', () => {
  const { major, minor } = splitPostgresMajorMinorVersions('17.2-0.0.0-beta1');

  expect(major).toBe('17');
  expect(minor).toBe('2-0.0.0-beta1');
});

test('gets only major version if no minor version is present', () => {
  const { major, minor } = splitPostgresMajorMinorVersions('15');

  expect(major).toBe('15');
  expect(minor).toBe('');
});
