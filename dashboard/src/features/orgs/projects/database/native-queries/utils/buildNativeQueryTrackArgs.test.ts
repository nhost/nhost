import buildNativeQueryTrackArgs from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryTrackArgs';
import { nativeQueryToFormValues } from '@/features/orgs/projects/database/native-queries/utils/nativeQueryOperations';
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
  arguments: {
    limit: {
      type: 'integer',
      nullable: true,
      description: '  External limit description  ',
    },
  },
  code: 'SELECT * FROM authors LIMIT {{limit}}',
  returns: 'author_result',
  comment: '  Created outside the dashboard  ',
  object_relationships: [relationship],
  array_relationships: [{ ...relationship, name: 'external_array' }],
};

const editedValues = {
  source: 'default',
  rootFieldName: 'renamed_authors',
  description: '  Updated author query  ',
  returns: 'author_result',
  code: 'SELECT * FROM authors',
  arguments: [],
};

describe('buildNativeQueryTrackArgs', () => {
  it('normalizes the top-level comment and required payload fields', () => {
    expect(buildNativeQueryTrackArgs(editedValues)).toEqual({
      source: 'default',
      root_field_name: 'renamed_authors',
      type: 'query',
      arguments: {},
      code: editedValues.code,
      returns: editedValues.returns,
      comment: 'Updated author query',
    });
  });

  it('trims meaningful argument descriptions independently and omits blank ones', () => {
    expect(
      buildNativeQueryTrackArgs({
        ...editedValues,
        description: '  Entity description  ',
        arguments: [
          {
            name: 'search',
            type: 'text',
            nullable: false,
            description: '  Argument description  ',
          },
          {
            name: 'limit',
            type: 'integer',
            nullable: true,
            description: '   ',
          },
        ],
      }),
    ).toEqual({
      source: 'default',
      root_field_name: 'renamed_authors',
      type: 'query',
      arguments: {
        search: {
          type: 'text',
          nullable: false,
          description: 'Argument description',
        },
        limit: { type: 'integer', nullable: true },
      },
      code: editedValues.code,
      returns: editedValues.returns,
      comment: 'Entity description',
    });
  });

  it('maps optional metadata descriptions to stable form strings without trimming', () => {
    expect(nativeQueryToFormValues(original)).toEqual({
      source: 'default',
      rootFieldName: 'authors',
      description: '  Created outside the dashboard  ',
      returns: 'author_result',
      code: 'SELECT * FROM authors LIMIT {{limit}}',
      arguments: [
        {
          name: 'limit',
          type: 'integer',
          nullable: true,
          description: '  External limit description  ',
        },
      ],
    });
    expect(
      nativeQueryToFormValues({ ...original, comment: undefined }).description,
    ).toBe('');
  });

  it('removes a stale original comment after clearing while preserving runtime relationships', () => {
    const result = buildNativeQueryTrackArgs(
      { ...editedValues, description: '' },
      original,
    );

    expect(result).toEqual({
      root_field_name: 'renamed_authors',
      type: 'query',
      arguments: {},
      code: editedValues.code,
      returns: editedValues.returns,
      object_relationships: original.object_relationships,
      array_relationships: original.array_relationships,
      source: 'default',
    });
    expect(result).not.toHaveProperty('comment');
    expect(result).not.toHaveProperty('description');
  });

  it('omits whitespace-only comments and never emits a top-level description key', () => {
    const result = buildNativeQueryTrackArgs({
      ...editedValues,
      description: '   ',
    });

    expect(result).not.toHaveProperty('comment');
    expect(result).not.toHaveProperty('description');
  });

  it('preserves other runtime properties while overriding every form-controlled value', () => {
    const originalWithRuntimeProperty = {
      ...original,
      runtime_property: { enabled: true },
    };

    expect(
      buildNativeQueryTrackArgs(editedValues, originalWithRuntimeProperty),
    ).toEqual({
      root_field_name: 'renamed_authors',
      type: 'query',
      arguments: {},
      code: editedValues.code,
      returns: editedValues.returns,
      object_relationships: original.object_relationships,
      array_relationships: original.array_relationships,
      runtime_property: { enabled: true },
      source: 'default',
      comment: 'Updated author query',
    });
  });
});
