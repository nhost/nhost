import { describe, expect, it } from 'vitest';
import { buildFilesWhereClause } from './buildFilesWhereClause';

describe('buildFilesWhereClause', () => {
  it('should return null when no filters are provided', () => {
    expect(buildFilesWhereClause({})).toBeNull();
  });

  it('should return null when searchString and bucketId are empty', () => {
    expect(
      buildFilesWhereClause({ searchString: '', bucketId: '' }),
    ).toBeNull();
  });

  it('should return bucket filter when only bucketId is provided', () => {
    expect(buildFilesWhereClause({ bucketId: 'default' })).toEqual({
      bucketId: { _eq: 'default' },
    });
  });

  it('should return search filter when only searchString is provided', () => {
    expect(buildFilesWhereClause({ searchString: 'photo' })).toEqual({
      _or: [{ name: { _ilike: '%photo%' } }],
    });
  });

  it('should include UUID match when searchString is a valid UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = buildFilesWhereClause({ searchString: uuid });

    expect(result).toEqual({
      _or: [{ id: { _eq: uuid } }, { name: { _ilike: `%${uuid}%` } }],
    });
  });

  it('should combine filters with _and when both are provided', () => {
    const result = buildFilesWhereClause({
      searchString: 'photo',
      bucketId: 'avatars',
    });

    expect(result).toEqual({
      _and: [
        { _or: [{ name: { _ilike: '%photo%' } }] },
        { bucketId: { _eq: 'avatars' } },
      ],
    });
  });

  it('should combine UUID search and bucket filter with _and', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = buildFilesWhereClause({
      searchString: uuid,
      bucketId: 'default',
    });

    expect(result).toEqual({
      _and: [
        {
          _or: [{ id: { _eq: uuid } }, { name: { _ilike: `%${uuid}%` } }],
        },
        { bucketId: { _eq: 'default' } },
      ],
    });
  });
});
