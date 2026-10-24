import getRedeployWarning from './getRedeployWarning';

const live = {
  commitSHA: 'a'.repeat(40),
  createdAt: '2026-10-20T12:00:00Z',
  status: 'succeeded',
};

it.each([
  { name: 'nothing is live', target: live, current: null, expected: null },
  {
    name: 'the target is the live commit',
    target: { ...live, status: 'failed', createdAt: '2026-10-21T12:00:00Z' },
    current: live,
    expected: null,
  },
  {
    name: 'the target is older',
    target: {
      ...live,
      commitSHA: 'b'.repeat(40),
      createdAt: '2026-10-19T12:00:00Z',
    },
    current: live,
    expected: 'older',
  },
  {
    name: 'the target is older and failed',
    target: {
      commitSHA: 'b'.repeat(40),
      createdAt: '2026-10-19T12:00:00Z',
      status: 'failed',
    },
    current: live,
    expected: 'older',
  },
  {
    name: 'the target is newer and failed',
    target: {
      commitSHA: 'b'.repeat(40),
      createdAt: '2026-10-21T12:00:00Z',
      status: 'failed',
    },
    current: live,
    expected: 'failed',
  },
  {
    name: 'the target is a newer failed legacy deployment',
    target: {
      commitSHA: 'b'.repeat(40),
      createdAt: '2026-10-21T12:00:00Z',
      status: 'FAILED',
    },
    current: live,
    expected: 'failed',
  },
  {
    name: 'the target is newer and aborted',
    target: {
      commitSHA: 'b'.repeat(40),
      createdAt: '2026-10-21T12:00:00Z',
      status: 'aborted',
    },
    current: live,
    expected: 'aborted',
  },
  {
    name: 'the target is newer and succeeded',
    target: {
      ...live,
      commitSHA: 'b'.repeat(40),
      createdAt: '2026-10-21T12:00:00Z',
    },
    current: live,
    expected: 'different',
  },
  {
    name: 'the target was created at the same time',
    target: { ...live, commitSHA: 'b'.repeat(40) },
    current: live,
    expected: 'different',
  },
  {
    name: 'the target has no creation time',
    target: { ...live, commitSHA: 'b'.repeat(40), createdAt: null },
    current: live,
    expected: 'different',
  },
])('returns $expected when $name', ({ target, current, expected }) => {
  expect(getRedeployWarning(target, current)).toBe(expected);
});
