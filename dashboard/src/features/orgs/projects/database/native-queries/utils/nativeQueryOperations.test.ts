import {
  buildCreateNativeQueryMigration,
  buildDeleteNativeQueryMigration,
  buildEditNativeQueryMigration,
  buildEditNativeQuerySteps,
} from '@/features/orgs/projects/database/native-queries/utils/nativeQueryOperations';
import type {
  NativeQueryItem,
  TrackNativeQueryArgs,
} from '@/utils/hasura-api/generated/schemas';

const objectRelationship = {
  name: 'author',
  using: {
    column_mapping: { author_id: 'id' },
    insertion_order: null,
    remote_native_query: 'author_by_id',
  },
};
const arrayRelationship = {
  name: 'books',
  using: {
    column_mapping: { id: 'author_id' },
    insertion_order: 'after_parent' as const,
    remote_native_query: 'books_by_author',
  },
};

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
  object_relationships: [objectRelationship],
  array_relationships: [arrayRelationship],
};

const updated: TrackNativeQueryArgs = {
  source: 'default',
  root_field_name: 'renamed_authors',
  type: 'query',
  arguments: {
    search: {
      type: 'text',
      nullable: false,
      description: 'Updated argument description',
    },
  },
  code: 'SELECT * FROM authors WHERE name ILIKE {{search}}',
  returns: 'author_result',
  comment: 'Updated query comment',
  object_relationships: [objectRelationship],
  array_relationships: [arrayRelationship],
};

const originalTrackArgs: TrackNativeQueryArgs = {
  ...original,
  source: 'default',
  type: 'query',
  arguments: original.arguments ?? {},
};

describe('native query operation builders', () => {
  it('builds create with a canonical default-source inverse', () => {
    expect(buildCreateNativeQueryMigration(updated)).toEqual({
      name: 'create_native_query_renamed_authors',
      up: [{ type: 'pg_track_native_query', args: updated }],
      down: [
        {
          type: 'pg_untrack_native_query',
          args: { source: 'default', root_field_name: updated.root_field_name },
        },
      ],
      datasource: 'default',
      skip_execution: false,
    });
  });

  it('canonicalizes inverse fields and supplies an empty arguments map', () => {
    const withoutArguments = {
      ...original,
      type: undefined,
      arguments: undefined,
    };

    expect(buildDeleteNativeQueryMigration(withoutArguments).down).toEqual([
      {
        type: 'pg_track_native_query',
        args: {
          ...withoutArguments,
          type: 'query',
          arguments: {},
          source: 'default',
        },
      },
    ]);
  });

  it('builds the atomic-compatible edit sequence in untrack/track order', () => {
    expect(buildEditNativeQuerySteps(updated, original)).toEqual([
      {
        type: 'pg_untrack_native_query',
        args: { source: 'default', root_field_name: original.root_field_name },
      },
      { type: 'pg_track_native_query', args: updated },
    ]);
  });

  it('builds an exact edit rollback with original comments, arguments, and relationships', () => {
    expect(buildEditNativeQueryMigration(updated, original)).toEqual({
      name: 'update_native_query_authors',
      up: [
        {
          type: 'pg_untrack_native_query',
          args: {
            source: 'default',
            root_field_name: original.root_field_name,
          },
        },
        { type: 'pg_track_native_query', args: updated },
      ],
      down: [
        {
          type: 'pg_untrack_native_query',
          args: { source: 'default', root_field_name: updated.root_field_name },
        },
        { type: 'pg_track_native_query', args: originalTrackArgs },
      ],
      datasource: 'default',
      skip_execution: false,
    });
  });

  it('builds an exact delete rollback with original comments, arguments, and relationships', () => {
    expect(buildDeleteNativeQueryMigration(original)).toEqual({
      name: 'delete_native_query_authors',
      up: [
        {
          type: 'pg_untrack_native_query',
          args: {
            source: 'default',
            root_field_name: original.root_field_name,
          },
        },
      ],
      down: [{ type: 'pg_track_native_query', args: originalTrackArgs }],
      datasource: 'default',
      skip_execution: false,
    });
  });
});
