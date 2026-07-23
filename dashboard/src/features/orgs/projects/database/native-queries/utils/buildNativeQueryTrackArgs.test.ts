import buildNativeQueryTrackArgs from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryTrackArgs';
import {
  buildDeleteNativeQueryMigration,
  buildEditNativeQueryMigration,
} from '@/features/orgs/projects/database/native-queries/utils/nativeQueryOperations';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

const relationship = {
  name: 'external_relationship',
  using: {
    column_mapping: { id: 'author_id' },
    insertion_order: null,
    remote_native_query: 'external_query',
  },
};

const original: NativeQueryItem = {
  root_field_name: 'authors',
  type: 'query',
  arguments: { limit: { type: 'integer', nullable: true } },
  code: 'SELECT * FROM authors LIMIT {{limit}}',
  returns: 'author_result',
  comment: 'Created outside the dashboard',
  object_relationships: [relationship],
  array_relationships: [{ ...relationship, name: 'external_array' }],
};

const editedValues = {
  rootFieldName: 'renamed_authors',
  returns: 'author_result',
  code: 'SELECT * FROM authors',
  arguments: [],
};

describe('buildNativeQueryTrackArgs', () => {
  it('normalizes required payload fields and always emits an arguments map', () => {
    expect(buildNativeQueryTrackArgs(editedValues)).toEqual({
      source: 'default',
      root_field_name: 'renamed_authors',
      type: 'query',
      arguments: {},
      code: editedValues.code,
      returns: editedValues.returns,
    });
  });

  it('preserves optional fields and both externally-created relationship arrays', () => {
    expect(buildNativeQueryTrackArgs(editedValues, original)).toMatchObject({
      comment: original.comment,
      object_relationships: original.object_relationships,
      array_relationships: original.array_relationships,
    });
  });

  it('preserves relationships in edit and delete rollback track bodies', () => {
    const edited = buildNativeQueryTrackArgs(editedValues, original);
    const editDownTrack = buildEditNativeQueryMigration(edited, original).down[1];
    const deleteDownTrack = buildDeleteNativeQueryMigration(original).down[0];

    expect(editDownTrack).toMatchObject({
      type: 'pg_track_native_query',
      args: {
        object_relationships: original.object_relationships,
        array_relationships: original.array_relationships,
      },
    });
    expect(deleteDownTrack).toMatchObject({
      type: 'pg_track_native_query',
      args: {
        object_relationships: original.object_relationships,
        array_relationships: original.array_relationships,
      },
    });
  });
});
