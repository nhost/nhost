import {
  buildEditNativeQuerySteps,
  buildTrackNativeQueryStep,
  buildUntrackNativeQueryStep,
  nativeQueryToFormValues,
} from '@/features/orgs/projects/database/native-queries/utils/nativeQueryOperations';
import type {
  NativeQueryItem,
  TrackNativeQueryArgs,
} from '@/utils/hasura-api/generated/schemas';

const original: NativeQueryItem = {
  root_field_name: 'authors',
  type: 'query',
  arguments: {
    limit: {
      type: 'integer',
      nullable: true,
      description: '  External argument description  ',
    },
  },
  code: 'SELECT * FROM authors LIMIT {{limit}}',
  returns: 'author_result',
  comment: '  External query comment  ',
  object_relationships: [
    {
      name: 'author',
      using: {
        column_mapping: { author_id: 'id' },
        insertion_order: null,
        remote_native_query: 'author_by_id',
      },
    },
  ],
  array_relationships: [
    {
      name: 'books',
      using: {
        column_mapping: { id: 'author_id' },
        insertion_order: 'after_parent',
        remote_native_query: 'books_by_author',
      },
    },
  ],
};

const updated: TrackNativeQueryArgs = {
  source: 'default',
  root_field_name: 'renamed_authors',
  type: 'query',
  arguments: {},
  code: 'SELECT * FROM authors',
  returns: 'author_result',
  object_relationships: original.object_relationships,
  array_relationships: original.array_relationships,
};

describe('native query metadata operation builders', () => {
  it('builds canonical track and untrack steps', () => {
    expect(buildTrackNativeQueryStep(updated)).toEqual({
      type: 'pg_track_native_query',
      args: updated,
    });
    expect(buildUntrackNativeQueryStep(original.root_field_name)).toEqual({
      type: 'pg_untrack_native_query',
      args: { source: 'default', root_field_name: original.root_field_name },
    });
  });

  it('round-trips form values without losing descriptions', () => {
    expect(nativeQueryToFormValues(original)).toEqual({
      source: 'default',
      rootFieldName: original.root_field_name,
      description: original.comment,
      returns: original.returns,
      code: original.code,
      arguments: [
        {
          name: 'limit',
          type: 'integer',
          nullable: true,
          description: '  External argument description  ',
        },
      ],
    });
  });

  it('builds the atomic edit sequence and retains full relationships', () => {
    expect(buildEditNativeQuerySteps(updated, original)).toEqual([
      {
        type: 'pg_untrack_native_query',
        args: { source: 'default', root_field_name: original.root_field_name },
      },
      {
        type: 'pg_track_native_query',
        args: updated,
      },
    ]);
  });
});
