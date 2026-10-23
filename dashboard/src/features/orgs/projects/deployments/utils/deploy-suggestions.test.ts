import type { UnifiedDeploymentRowFragment } from '@/generated/graphql';
import type { GitHubCommit } from '@/lib/github';
import {
  dedupeDeploymentsByCommit,
  escapeILike,
  filterCommits,
  rankBySha,
  splitHighlight,
} from './deploy-suggestions';

it.each([
  { input: 'comments', expected: 'comments' },
  { input: '100%', expected: '100\\%' },
  { input: 'add_comments', expected: 'add\\_comments' },
  { input: 'path\\name', expected: 'path\\\\name' },
  { input: '%_\\', expected: '\\%\\_\\\\' },
])('escapes "$input" for an ILIKE pattern', ({ input, expected }) => {
  expect(escapeILike(input)).toBe(expected);
});

it('keeps the newest row per commit in server order, omitting missing commits', () => {
  const deployments: UnifiedDeploymentRowFragment[] = [
    { id: 'newest', commitSHA: 'a'.repeat(40) },
    { id: 'missing', commitSHA: null },
    { id: 'other', commitSHA: 'b'.repeat(40) },
    { id: 'duplicate', commitSHA: 'a'.repeat(40) },
    { id: 'ref', commitSHA: 'main' },
    { id: 'empty', commitSHA: '' },
  ];
  expect(dedupeDeploymentsByCommit(deployments)).toEqual([
    deployments[0],
    deployments[2],
    deployments[4],
  ]);
});

const commits: GitHubCommit[] = [
  {
    sha: 'a'.repeat(40),
    message: 'Add COMMENTS table',
    authorName: '',
    avatarUrl: null,
    date: null,
  },
  {
    sha: `c4d8${'b'.repeat(36)}`,
    message: 'Refactor permissions',
    authorName: '',
    avatarUrl: null,
    date: null,
  },
  {
    sha: 'd'.repeat(40),
    message: 'Add reactions\nto comments',
    authorName: '',
    avatarUrl: null,
    date: null,
  },
];

it.each([
  { query: 'comments', expected: [commits[0], commits[2]] },
  { query: 'CoMmEnTs', expected: [commits[0], commits[2]] },
  { query: 'c4d8', expected: [commits[1]] },
  { query: 'C4D8', expected: [commits[1]] },
  { query: '4d8b', expected: [] },
  { query: 'not found', expected: [] },
  { query: '', expected: [] },
])('filters commits for "$query"', ({ query, expected }) => {
  expect(filterCommits(commits, query)).toEqual(expected);
});

it.each([
  {
    query: 'a',
    expected: [
      'a'.repeat(40),
      `${'a'.repeat(39)}b`,
      'c'.repeat(40),
      'd'.repeat(40),
      'e'.repeat(40),
    ],
  },
  {
    query: 'match',
    expected: [
      'c'.repeat(40),
      'd'.repeat(40),
      'e'.repeat(40),
      'f'.repeat(40),
      'b'.repeat(40),
    ],
  },
])(
  'ranks before capping commit matches for "$query"',
  ({ query, expected }) => {
    const rows = ['c', 'd', 'e', 'f', 'b', 'a'].map((char) => ({
      ...commits[0],
      sha: char.repeat(40),
      message: 'a match',
    }));
    rows.push({ ...commits[0], sha: `${'a'.repeat(39)}b`, message: 'match' });
    expect(filterCommits(rows, query).map((commit) => commit.sha)).toEqual(
      expected,
    );
  },
);

it.each([
  { query: 'c4d8', expected: ['sha', 'message', 'other', 'missing', 'ref'] },
  {
    query: `c4d8${'b'.repeat(36)}`,
    expected: ['sha', 'message', 'other', 'missing', 'ref'],
  },
  { query: 'C4D8', expected: ['sha', 'message', 'other', 'missing', 'ref'] },
  { query: '', expected: ['message', 'other', 'missing', 'ref', 'sha'] },
  { query: 'feed', expected: ['message', 'other', 'missing', 'ref', 'sha'] },
])(
  'ranks SHA matches first for "$query" without mutating server order',
  ({ query, expected }) => {
    const items = [
      { id: 'message', sha: 'a'.repeat(40) },
      { id: 'other', sha: 'b'.repeat(40) },
      { id: 'missing', sha: null },
      { id: 'ref', sha: 'feed' },
      { id: 'sha', sha: `c4d8${'b'.repeat(36)}` },
    ];
    expect(
      rankBySha(items, query, (item) => item.sha).map((item) => item.id),
    ).toEqual(expected);
    expect(items.map((item) => item.id)).toEqual([
      'message',
      'other',
      'missing',
      'ref',
      'sha',
    ]);
  },
);

it.each([
  {
    text: 'Add COMMENTS table',
    query: 'comments',
    expected: [
      ['Add ', false],
      ['COMMENTS', true],
      [' table', false],
    ],
  },
  {
    text: 'comments and comments',
    query: 'comments',
    expected: [
      ['comments', true],
      [' and ', false],
      ['comments', true],
    ],
  },
  {
    text: 'feat/comments',
    query: 'feat/',
    expected: [
      ['feat/', true],
      ['comments', false],
    ],
  },
  {
    text: 'c4d8bcd',
    query: 'c4d8',
    expected: [
      ['c4d8', true],
      ['bcd', false],
    ],
  },
  {
    text: 'a.*b',
    query: '.*',
    expected: [
      ['a', false],
      ['.*', true],
      ['b', false],
    ],
  },
  { text: 'unchanged', query: 'no match', expected: [['unchanged', false]] },
  { text: 'unchanged', query: '', expected: [['unchanged', false]] },
  { text: '', query: 'a', expected: [['', false]] },
])('highlights "$query" literally in "$text"', ({ text, query, expected }) => {
  expect(
    splitHighlight(text, query).map((part) => [part.text, part.highlighted]),
  ).toEqual(expected);
  expect(
    splitHighlight(text, query)
      .map((part) => text.slice(part.start, part.start + part.text.length))
      .join(''),
  ).toBe(text);
});
