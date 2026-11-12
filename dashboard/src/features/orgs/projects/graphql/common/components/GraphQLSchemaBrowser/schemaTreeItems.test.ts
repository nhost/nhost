import { buildSchema } from 'graphql';
import {
  createRootItems,
  expandTreeItem,
  getNodeLabel,
  ROOT_ITEM_ID,
} from './schemaTreeItems';
import { createTestSchema } from './testSchema';
import type { SchemaTreeItems } from './types';

const schema = createTestSchema();

function expandPath(itemIds: string[]): SchemaTreeItems {
  return itemIds.reduce(
    (items, itemId) => expandTreeItem(schema, items, itemId),
    createRootItems(schema),
  );
}

describe('createRootItems', () => {
  it('lists only the operations the schema has', () => {
    const items = createRootItems(schema);

    expect(items[ROOT_ITEM_ID].children).toEqual(['query', 'mutation']);
    expect(items.query.data).toMatchObject({
      kind: 'operation',
      name: 'Query',
      typeName: 'query_root',
    });
  });

  it('does not build operation fields before the operation is expanded', () => {
    const items = createRootItems(schema);

    expect(items.query.isFolder).toBe(true);
    expect(items.query.children).toEqual([]);
    expect(items['query/users']).toBeUndefined();
  });

  it('handles a schema with only a query root', () => {
    const items = createRootItems(buildSchema('type Query { ping: String }'));

    expect(items[ROOT_ITEM_ID].children).toEqual(['query']);
  });
});

describe('expandTreeItem', () => {
  it('lists root fields with their type, description and root flag', () => {
    const items = expandPath(['query']);

    expect(items.query.children).toEqual(['query/users', 'query/search']);
    expect(items['query/users'].data).toMatchObject({
      kind: 'field',
      typeLabel: '[users!]!',
      typeName: 'users',
      description: 'fetch users',
      isRootField: true,
    });
    expect(getNodeLabel(items['query/users'].data)).toBe('users: [users!]!');
  });

  it('lists the fields of the return type of a field', () => {
    const items = expandPath(['query', 'query/users']);

    expect(items['query/users'].children).toEqual([
      'query/users/id',
      'query/users/displayName',
      'query/users/posts',
      'query/users/oldName',
    ]);
    expect(items['query/users/id'].data.isRootField).toBeUndefined();
    expect(items['query/users/oldName'].data.deprecationReason).toBe(
      'Use displayName',
    );
  });

  it('lists the arguments of a field before its return type fields', () => {
    const items = expandPath(['query', 'query/users', 'query/users/posts']);

    expect(items['query/users/posts'].children).toEqual([
      'query/users/posts/@limit',
      'query/users/posts/@where',
      'query/users/posts/id',
      'query/users/posts/title',
      'query/users/posts/author',
    ]);
    expect(items['query/users/posts/@where'].data).toMatchObject({
      kind: 'argument',
      typeLabel: 'posts_bool_exp',
    });
  });

  it('expands circular references one level at a time', () => {
    const items = expandPath([
      'query',
      'query/users',
      'query/users/posts',
      'query/users/posts/author',
    ]);

    expect(items['query/users/posts/author'].children).toEqual([
      'query/users/posts/author/id',
      'query/users/posts/author/displayName',
      'query/users/posts/author/posts',
      'query/users/posts/author/oldName',
    ]);
    expect(items['query/users/posts/author/posts'].children).toEqual([]);
  });

  it('lists input fields of input object arguments and enum values', () => {
    const items = expandPath([
      'query',
      'query/users',
      'query/users/posts',
      'query/users/posts/@where',
      'query/users/posts/@where/status',
    ]);

    expect(items['query/users/posts/@where'].children).toEqual([
      'query/users/posts/@where/_and',
      'query/users/posts/@where/title',
      'query/users/posts/@where/status',
    ]);
    expect(items['query/users/posts/@where/status'].children).toEqual([
      'query/users/posts/@where/status/#DRAFT',
      'query/users/posts/@where/status/#PUBLISHED',
    ]);
    expect(items['query/users/posts/@where/status/#DRAFT'].data).toMatchObject({
      kind: 'enumValue',
      ownerType: 'post_status',
    });
  });

  it('lists union members, which expand into their fields', () => {
    const items = expandPath(['query', 'query/search', 'query/search/|posts']);

    expect(items['query/search'].children).toEqual([
      'query/search/@term',
      'query/search/|users',
      'query/search/|posts',
    ]);
    expect(items['query/search/|posts'].children).toEqual([
      'query/search/|posts/id',
      'query/search/|posts/title',
      'query/search/|posts/author',
    ]);
  });

  it('marks scalar fields and arguments as leaves', () => {
    const items = expandPath(['query', 'query/search']);

    expect(items['query/search/@term'].isFolder).toBe(false);
    expect(items['query/search/@term'].children).toBeUndefined();
  });

  it('keeps the existing items when an item is expanded again', () => {
    const items = expandPath(['query']);

    expect(expandTreeItem(schema, items, 'query')).toBe(items);
  });
});
