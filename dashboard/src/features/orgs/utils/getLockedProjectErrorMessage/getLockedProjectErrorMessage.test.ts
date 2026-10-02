import getLockedProjectErrorMessage from '@/features/orgs/utils/getLockedProjectErrorMessage/getLockedProjectErrorMessage';

describe('getLockedProjectErrorMessage', () => {
  it('returns the generic message for an unrelated error', () => {
    const resolveMessage = getLockedProjectErrorMessage(
      'Something went wrong.',
    );

    expect(resolveMessage(new Error('Unexpected failure'))).toBe(
      'Something went wrong.',
    );
  });

  it('returns the project lock reason', () => {
    const resolveMessage = getLockedProjectErrorMessage(
      'Something went wrong.',
    );

    expect(
      resolveMessage(new Error('app is locked: billing needs attention')),
    ).toBe('Project is locked: billing needs attention');
  });
});
