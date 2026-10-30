import isCommitSHA from './isCommitSHA';

it('accepts a full commit SHA in any case', () => {
  expect(isCommitSHA('a1b2c3d4e5'.repeat(4))).toBe(true);
  expect(isCommitSHA('A1B2C3D4E5'.repeat(4))).toBe(true);
});

it('rejects a short SHA, a branch, a tag and no ref', () => {
  expect(isCommitSHA('a1b2c3d')).toBe(false);
  // As long as a full SHA, but not hexadecimal.
  expect(isCommitSHA('feat/'.padEnd(40, 'x'))).toBe(false);
  expect(isCommitSHA('v1.2.3')).toBe(false);
  expect(isCommitSHA(null)).toBe(false);
});
