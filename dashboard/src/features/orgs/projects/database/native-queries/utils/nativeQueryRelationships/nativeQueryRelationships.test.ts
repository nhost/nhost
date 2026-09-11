import {
  addNativeQueryRelationship,
  columnMappingToFieldMappings,
  fieldMappingsToColumnMapping,
  removeNativeQueryRelationship,
  updateNativeQueryRelationship,
} from '@/features/orgs/projects/database/native-queries/utils/nativeQueryRelationships';
import type {
  NativeQueryItem,
  NativeQueryRelationship,
} from '@/utils/hasura-api/generated/schemas';

const objectRelationship = {
  name: 'author',
  using: {
    column_mapping: { author_id: 'id' },
    insertion_order: null,
    remote_native_query: 'authors',
  },
};
const arrayRelationship = {
  name: 'comments',
  using: {
    column_mapping: { id: 'article_id' },
    insertion_order: 'after_parent' as const,
    remote_native_query: 'comments',
  },
};
const tableRelationship: NativeQueryRelationship = {
  name: 'reviewer',
  comment: 'Preserve table metadata',
  using: {
    column_mapping: { reviewer_id: 'id' },
    insertion_order: null,
    remote_table: { schema: 'public', name: 'users' },
  },
};
const query: NativeQueryItem = {
  root_field_name: 'articles',
  type: 'query',
  arguments: { published: { type: 'boolean', nullable: true } },
  code: 'SELECT * FROM articles',
  returns: 'article_model',
  description: 'keep me',
  object_relationships: [objectRelationship],
  array_relationships: [arrayRelationship],
};

const input = {
  name: 'editor',
  kind: 'object' as const,
  remoteNativeQuery: 'authors',
  fieldMappings: [{ sourceField: 'editor_id', targetField: 'id' }],
  insertionOrder: null,
};

describe('native query relationship helpers', () => {
  it('converts source fields to mapping keys and target fields to values', () => {
    expect(fieldMappingsToColumnMapping(input.fieldMappings)).toEqual({
      editor_id: 'id',
    });
    expect(columnMappingToFieldMappings({ editor_id: 'id' })).toEqual(
      input.fieldMappings,
    );
  });

  it('adds object and array relationships without changing query fields or siblings', () => {
    const withObject = addNativeQueryRelationship(query, input);
    const withArray = addNativeQueryRelationship(query, {
      ...input,
      name: 'editors',
      kind: 'array',
    });

    expect(withObject).toEqual({
      ...query,
      object_relationships: [
        objectRelationship,
        expect.objectContaining({ name: 'editor' }),
      ],
    });
    expect(withArray).toEqual({
      ...query,
      array_relationships: [
        arrayRelationship,
        expect.objectContaining({ name: 'editors' }),
      ],
    });
  });

  it('moves an edited relationship across collections and retains unrelated relationships', () => {
    expect(
      updateNativeQueryRelationship(query, 'author', {
        ...input,
        name: 'writers',
        kind: 'array',
        insertionOrder: objectRelationship.using.insertion_order,
      }),
    ).toEqual({
      ...query,
      object_relationships: [],
      array_relationships: [
        arrayRelationship,
        expect.objectContaining({ name: 'writers' }),
      ],
    });
  });

  it('removes a named relationship from either collection only', () => {
    expect(removeNativeQueryRelationship(query, 'author')).toEqual({
      ...query,
      object_relationships: [],
    });
    expect(removeNativeQueryRelationship(query, 'comments')).toEqual({
      ...query,
      array_relationships: [],
    });
  });

  it('preserves the full native query and relationship name unchanged when editing', () => {
    const updated = updateNativeQueryRelationship(query, 'author', {
      name: '_writer2',
      kind: 'object',
      remoteNativeQuery: 'authors',
      fieldMappings: [{ sourceField: 'author_id', targetField: 'id' }],
      insertionOrder: null,
    });

    expect(updated).toEqual({
      ...query,
      object_relationships: [
        {
          name: '_writer2',
          using: objectRelationship.using,
        },
      ],
    });
  });

  it.each([
    'Managed outside the dashboard',
    null,
  ])('preserves the existing comment %j when updating a relationship', (comment) => {
    const commentedRelationship: NativeQueryRelationship = {
      ...objectRelationship,
      comment,
    };
    const updated = updateNativeQueryRelationship(
      { ...query, object_relationships: [commentedRelationship] },
      'author',
      { ...input, name: 'writer' },
    );

    expect(updated.object_relationships?.[0]).toEqual(
      expect.objectContaining({ comment }),
    );
  });

  it('preserves table-backed siblings verbatim when updating a native-query relationship', () => {
    const queryWithTableRelationship: NativeQueryItem = {
      ...query,
      object_relationships: [objectRelationship, tableRelationship],
    };

    const updated = updateNativeQueryRelationship(
      queryWithTableRelationship,
      'author',
      {
        ...input,
        name: 'writer',
      },
    );

    expect(updated.object_relationships).toEqual([
      expect.objectContaining({ name: 'writer' }),
      tableRelationship,
    ]);
    expect(updated.object_relationships?.[1]).toBe(tableRelationship);
  });

  it('enforces relationship name uniqueness across both collections', () => {
    expect(() =>
      addNativeQueryRelationship(query, { ...input, name: 'author' }),
    ).toThrow('Relationship names must be unique.');
    expect(() =>
      addNativeQueryRelationship(query, { ...input, name: 'comments' }),
    ).toThrow('Relationship names must be unique.');
  });
});
