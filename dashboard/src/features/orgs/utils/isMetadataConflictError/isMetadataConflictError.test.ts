import isMetadataConflictError from '@/features/orgs/utils/isMetadataConflictError/isMetadataConflictError';

describe('isMetadataConflictError', () => {
  it('matches a metadata resource version conflict', () => {
    const error = new Error(
      'metadata resource version referenced (70) did not match current version',
    );

    expect(isMetadataConflictError(error)).toBe(true);
  });

  it('does not match an unrelated error', () => {
    const error = new Error('Something went wrong');

    expect(isMetadataConflictError(error)).toBe(false);
  });
});
