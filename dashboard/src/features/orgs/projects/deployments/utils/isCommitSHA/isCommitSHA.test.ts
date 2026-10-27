import isCommitSHA from './isCommitSHA';

it.each([
  { name: 'a full commit SHA', ref: 'a1b2c3d4e5'.repeat(4), expected: true },
  {
    name: 'an uppercase full commit SHA',
    ref: 'A1B2C3D4E5'.repeat(4),
    expected: true,
  },
  { name: 'a short commit SHA', ref: 'a1b2c3d', expected: false },
  {
    name: 'a 40-character branch',
    ref: 'feat/'.padEnd(40, 'x'),
    expected: false,
  },
  { name: 'a tag', ref: 'v1.2.3', expected: false },
  { name: 'no ref', ref: null, expected: false },
])('returns $expected for $name', ({ ref, expected }) => {
  expect(isCommitSHA(ref)).toBe(expected);
});
