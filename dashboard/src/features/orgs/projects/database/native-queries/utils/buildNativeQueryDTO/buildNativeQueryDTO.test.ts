import { buildNativeQueryDTO } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryDTO';
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
  description: '  Created outside the dashboard  ',
  object_relationships: [relationship],
  array_relationships: [{ ...relationship, name: 'external_array' }],
};

const editedValues = {
  source: 'analytics',
  rootFieldName: 'renamed_authors',
  description: '  Updated author query  ',
  returns: 'author_result',
  code: 'SELECT * FROM authors',
  arguments: [],
};

describe('buildNativeQueryDTO', () => {
  it('splits the source from normalized operation arguments', () => {
    expect(buildNativeQueryDTO(editedValues)).toEqual({
      source: 'analytics',
      args: {
        root_field_name: 'renamed_authors',
        type: 'query',
        arguments: {},
        code: editedValues.code,
        returns: editedValues.returns,
        description: 'Updated author query',
      },
    });
  });

  it('preserves argument names while normalizing descriptions', () => {
    expect(
      buildNativeQueryDTO({
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
      source: 'analytics',
      args: {
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
        description: 'Entity description',
      },
    });
  });

  it('removes a cleared description while preserving runtime relationships', () => {
    const result = buildNativeQueryDTO(
      { ...editedValues, description: '' },
      original,
    );

    expect(result).toEqual({
      source: 'analytics',
      args: {
        root_field_name: 'renamed_authors',
        type: 'query',
        arguments: {},
        code: editedValues.code,
        returns: editedValues.returns,
        object_relationships: original.object_relationships,
        array_relationships: original.array_relationships,
      },
    });
    expect(result.args).not.toHaveProperty('comment');
    expect(result.args).not.toHaveProperty('description');
    expect(result.args).not.toHaveProperty('source');
  });

  it('preserves runtime properties while overriding form-controlled values', () => {
    const originalWithRuntimeProperty = {
      ...original,
      runtime_property: { enabled: true },
    };

    expect(
      buildNativeQueryDTO(editedValues, originalWithRuntimeProperty),
    ).toEqual({
      source: 'analytics',
      args: {
        root_field_name: 'renamed_authors',
        type: 'query',
        arguments: {},
        code: editedValues.code,
        returns: editedValues.returns,
        object_relationships: original.object_relationships,
        array_relationships: original.array_relationships,
        runtime_property: { enabled: true },
        description: 'Updated author query',
      },
    });
  });
});
