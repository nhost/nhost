import { createRootItems, expandTreeItem } from './schemaTreeItems';
import searchSchema from './searchSchema';
import { createTestSchema } from './testSchema';

const schema = createTestSchema();

describe('searchSchema', () => {
  it('returns the shortest path to each match, in tree order', () => {
    expect(searchSchema(schema, 'title')).toEqual([
      [
        'query',
        'query/users',
        'query/users/posts',
        'query/users/posts/@where',
        'query/users/posts/@where/title',
      ],
      ['query', 'query/users', 'query/users/posts', 'query/users/posts/title'],
    ]);
  });

  it('lists each schema location once, even when types reference each other', () => {
    const paths = searchSchema(schema, 'users').map(
      (path) => path[path.length - 1],
    );

    expect(paths).toEqual([
      'query/users',
      'query/users/posts/author',
      'query/search/|users',
      'mutation/delete_users',
    ]);
  });

  it('matches field types as well as names', () => {
    const paths = searchSchema(schema, 'post_status').map(
      (path) => path[path.length - 1],
    );

    expect(paths).toEqual(['query/users/posts/@where/status']);
  });

  it('matches enum values and operations case-insensitively', () => {
    expect(searchSchema(schema, 'published')).toEqual([
      [
        'query',
        'query/users',
        'query/users/posts',
        'query/users/posts/@where',
        'query/users/posts/@where/status',
        'query/users/posts/@where/status/#PUBLISHED',
      ],
    ]);
    expect(searchSchema(schema, 'MUTATION')).toEqual([['mutation']]);
  });

  it('returns no matches for an empty term', () => {
    expect(searchSchema(schema, '')).toEqual([]);
    expect(searchSchema(schema, '   ')).toEqual([]);
  });

  it('returns paths that exist in the tree', () => {
    const paths = searchSchema(schema, 'e');

    expect(paths.length).toBeGreaterThan(10);

    for (const path of paths) {
      const items = path
        .slice(0, -1)
        .reduce(
          (current, itemId) => expandTreeItem(schema, current, itemId),
          createRootItems(schema),
        );

      expect(items[path[path.length - 1]]).toBeDefined();
    }
  });
});
