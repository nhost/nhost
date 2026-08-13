import {
  countLogicalModelDependents,
  findLogicalModelDependents,
} from '@/features/orgs/projects/database/native-queries/utils/logical-model-dependents';
import type {
  LogicalModelItem,
  LogicalModelType,
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

const scalar: LogicalModelType = { scalar: 'text', nullable: false };

const model = (
  name: string,
  fields: { name: string; type: LogicalModelType }[] = [],
): LogicalModelItem => ({ name, fields });

const query = (rootFieldName: string, returns: string): NativeQueryItem => ({
  root_field_name: rootFieldName,
  code: 'SELECT 1',
  returns,
});

const find = ({
  logicalModels = [],
  nativeQueries = [],
}: {
  logicalModels?: LogicalModelItem[];
  nativeQueries?: NativeQueryItem[];
}) =>
  findLogicalModelDependents({
    name: 'author',
    logicalModels,
    nativeQueries,
  });

describe('findLogicalModelDependents', () => {
  it('reports nothing when no entity references the logical model', () => {
    const dependents = find({
      logicalModels: [
        model('author', [{ name: 'id', type: scalar }]),
        model('book', [{ name: 'title', type: scalar }]),
      ],
      nativeQueries: [query('search_books', 'book')],
    });

    expect(dependents).toEqual({ nativeQueries: [], logicalModels: [] });
    expect(countLogicalModelDependents(dependents)).toBe(0);
  });

  it('reports native queries returning the logical model', () => {
    const dependents = find({
      nativeQueries: [
        query('search_authors', 'author'),
        query('list_authors', 'author'),
        query('search_books', 'book'),
      ],
    });

    expect(dependents.nativeQueries).toEqual([
      'search_authors',
      'list_authors',
    ]);
    expect(countLogicalModelDependents(dependents)).toBe(2);
  });

  it.each([
    {
      label: 'a direct logical model field',
      type: { logical_model: 'author', nullable: false } as LogicalModelType,
    },
    {
      label: 'an array of the logical model',
      type: {
        array: { logical_model: 'author', nullable: false },
        nullable: false,
      } as LogicalModelType,
    },
    {
      label: 'a nested array of arrays',
      type: {
        array: {
          array: { logical_model: 'author', nullable: true },
          nullable: false,
        },
        nullable: false,
      } as LogicalModelType,
    },
  ])('reports logical models referencing it through $label', ({ type }) => {
    const dependents = find({
      logicalModels: [model('book', [{ name: 'written_by', type }])],
    });

    expect(dependents.logicalModels).toEqual([
      { name: 'book', fields: ['written_by'] },
    ]);
  });

  it('collects every referencing field of a dependent logical model', () => {
    const dependents = find({
      logicalModels: [
        model('book', [
          { name: 'title', type: scalar },
          {
            name: 'written_by',
            type: { logical_model: 'author', nullable: false },
          },
          {
            name: 'reviewers',
            type: {
              array: { logical_model: 'author', nullable: false },
              nullable: false,
            },
          },
        ]),
      ],
    });

    expect(dependents.logicalModels).toEqual([
      { name: 'book', fields: ['written_by', 'reviewers'] },
    ]);
  });

  it('ignores a logical model that only references itself', () => {
    const dependents = find({
      logicalModels: [
        model('author', [
          { name: 'mentor', type: { logical_model: 'author', nullable: true } },
        ]),
      ],
    });

    expect(dependents.logicalModels).toEqual([]);
  });

  it('ignores logical models whose fields reference a different model', () => {
    const dependents = find({
      logicalModels: [
        model('book', [
          {
            name: 'publisher',
            type: { logical_model: 'publisher', nullable: false },
          },
        ]),
      ],
    });

    expect(dependents.logicalModels).toEqual([]);
  });

  it('combines native query and logical model dependents', () => {
    const dependents = find({
      logicalModels: [
        model('book', [
          {
            name: 'written_by',
            type: { logical_model: 'author', nullable: false },
          },
        ]),
        model('magazine', [
          {
            name: 'contributors',
            type: {
              array: { logical_model: 'author', nullable: false },
              nullable: false,
            },
          },
        ]),
      ],
      nativeQueries: [query('search_authors', 'author')],
    });

    expect(dependents).toEqual({
      nativeQueries: ['search_authors'],
      logicalModels: [
        { name: 'book', fields: ['written_by'] },
        { name: 'magazine', fields: ['contributors'] },
      ],
    });
    expect(countLogicalModelDependents(dependents)).toBe(3);
  });
});
