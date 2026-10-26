import {
  canResolveDeploymentRef,
  describeCommitRelation,
} from './commit-relation';

it.each([
  {
    input: { aheadBy: 2, behindBy: 0, identical: false },
    expected: {
      text: '2 commits ahead of the live deployment',
      warning: false,
    },
  },
  {
    input: { aheadBy: 1, behindBy: 0, identical: false },
    expected: { text: '1 commit ahead of the live deployment', warning: false },
  },
  {
    input: { aheadBy: 0, behindBy: 1, identical: false },
    expected: { text: '1 commit behind the live deployment', warning: true },
  },
  {
    input: { aheadBy: 0, behindBy: 3, identical: false },
    expected: { text: '3 commits behind the live deployment', warning: true },
  },
  {
    input: { aheadBy: 2, behindBy: 4, identical: false },
    expected: { text: '4 commits behind the live deployment', warning: true },
  },
  { input: { aheadBy: 0, behindBy: 0, identical: true }, expected: null },
])('describes $input as $expected', ({ input, expected }) => {
  expect(describeCommitRelation(input)).toEqual(expected);
});

it.each([
  { input: 'feed', expected: true },
  { input: '2024', expected: true },
  { input: 'a1', expected: true },
  { input: 'abc1234', expected: true },
  { input: 'feat/comments', expected: true },
  { input: '', expected: false },
  { input: ' ', expected: false },
  { input: 'two words', expected: false },
  { input: ' main', expected: false },
  { input: 'main\n', expected: false },
])('resolves "$input": $expected', ({ input, expected }) => {
  expect(canResolveDeploymentRef(input)).toBe(expected);
});
