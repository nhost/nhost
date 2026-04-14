import { v4 as uuidv4 } from 'uuid';
import { describe, expect, it } from 'vitest';
import type {
  ConditionNode,
  ExistsNode,
  GroupNode,
  RelationshipNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import validationSchemas from './validationSchemas';

function condition(
  column: string,
  operator: string,
  value: unknown = 'val',
): ConditionNode {
  return {
    type: 'condition',
    id: uuidv4(),
    column,
    operator: operator as ConditionNode['operator'],
    value,
  };
}

function group(
  operator: GroupNode['operator'],
  children: GroupNode['children'],
): GroupNode {
  return { type: 'group', id: uuidv4(), operator, children };
}

function existsNode(
  schema: string,
  table: string,
  where: GroupNode,
): ExistsNode {
  return { type: 'exists', id: uuidv4(), schema, table, where };
}

function relationshipNode(
  relationship: string,
  child: GroupNode,
): RelationshipNode {
  return { type: 'relationship', id: uuidv4(), relationship, child };
}

const validationSchema = validationSchemas.select;

async function validateFilter(filter: GroupNode | null) {
  return validationSchema.validateAt('filter', { filter }).then(
    () => null,
    (err: { message: string }) => err.message,
  );
}

describe('validationSchemas — duplicate flat condition detection', () => {
  it('passes when there are no duplicates in an _implicit group', async () => {
    const filter = group('_implicit', [
      condition('col1', '_eq'),
      condition('col2', '_eq'),
    ]);
    expect(await validateFilter(filter)).toBeNull();
  });

  it('passes when there are no duplicates in an _and group', async () => {
    const filter = group('_and', [
      condition('col', '_eq'),
      condition('col', '_eq'),
    ]);
    expect(await validateFilter(filter)).toBeNull();
  });

  it('passes when same column has different operators in an _implicit group', async () => {
    const filter = group('_implicit', [
      condition('col', '_eq'),
      condition('col', '_neq'),
    ]);
    expect(await validateFilter(filter)).toBeNull();
  });

  it('fails when two conditions share column and operator in an _implicit group', async () => {
    const filter = group('_implicit', [
      condition('col', '_in', ['a']),
      condition('col', '_in', ['b']),
    ]);
    expect(await validateFilter(filter)).toMatch(
      /Column "col" with operator "_in" appears more than once/,
    );
  });

  it('fails when two conditions share column and operator in a _not group with multiple children', async () => {
    const filter = group('_implicit', [
      group('_not', [
        condition('col', '_eq', 'a'),
        condition('col', '_eq', 'b'),
      ]),
    ]);
    expect(await validateFilter(filter)).toMatch(
      /Column "col" with operator "_eq" appears more than once/,
    );
  });

  it('passes when _not has only one child (no flat merge occurs)', async () => {
    const filter = group('_implicit', [
      group('_not', [condition('col', '_eq', 'a')]),
    ]);
    expect(await validateFilter(filter)).toBeNull();
  });

  it('fails when duplicate is inside a nested _implicit group', async () => {
    const filter = group('_and', [
      condition('other', '_eq'),
      group('_implicit', [
        condition('col', '_in', ['a']),
        condition('col', '_in', ['b']),
      ]),
    ]);
    expect(await validateFilter(filter)).toMatch(
      /Column "col" with operator "_in" appears more than once/,
    );
  });

  it('fails when duplicate is inside an _exists where clause', async () => {
    const filter = group('_implicit', [
      existsNode(
        'public',
        'users',
        group('_implicit', [
          condition('col', '_eq', 'a'),
          condition('col', '_eq', 'b'),
        ]),
      ),
    ]);
    expect(await validateFilter(filter)).toMatch(
      /Column "col" with operator "_eq" appears more than once/,
    );
  });

  it('passes when filter is null', async () => {
    expect(await validateFilter(null)).toBeNull();
  });
});

describe('validationSchemas — duplicate logical operator detection', () => {
  it('fails when two _and groups are siblings in an _implicit group', async () => {
    const filter = group('_implicit', [
      group('_and', [condition('a', '_eq'), condition('b', '_eq')]),
      group('_and', [condition('c', '_eq'), condition('d', '_eq')]),
    ]);
    expect(await validateFilter(filter)).toMatch(
      /Multiple "_and" groups at the same level/,
    );
  });

  it('fails when two _or groups are siblings in an _implicit group', async () => {
    const filter = group('_implicit', [
      group('_or', [condition('a', '_eq'), condition('b', '_eq')]),
      group('_or', [condition('c', '_eq'), condition('d', '_eq')]),
    ]);
    expect(await validateFilter(filter)).toMatch(
      /Multiple "_or" groups at the same level/,
    );
  });

  it('fails when two _not groups are siblings in an _implicit group', async () => {
    const filter = group('_implicit', [
      group('_not', [condition('a', '_eq')]),
      group('_not', [condition('b', '_eq')]),
    ]);
    expect(await validateFilter(filter)).toMatch(
      /Multiple "_not" groups at the same level/,
    );
  });

  it('passes when _and and _or are siblings (different operators)', async () => {
    const filter = group('_implicit', [
      group('_and', [condition('a', '_eq'), condition('b', '_eq')]),
      group('_or', [condition('c', '_eq'), condition('d', '_eq')]),
    ]);
    expect(await validateFilter(filter)).toBeNull();
  });

  it('passes when two _and groups are inside an _and parent (not flat)', async () => {
    const filter = group('_and', [
      group('_and', [condition('a', '_eq'), condition('b', '_eq')]),
      group('_and', [condition('c', '_eq'), condition('d', '_eq')]),
    ]);
    expect(await validateFilter(filter)).toBeNull();
  });

  it('fails when duplicate logical ops are nested inside an _exists where', async () => {
    const filter = group('_implicit', [
      existsNode(
        'public',
        'users',
        group('_implicit', [
          group('_and', [condition('a', '_eq'), condition('b', '_eq')]),
          group('_and', [condition('c', '_eq'), condition('d', '_eq')]),
        ]),
      ),
    ]);
    expect(await validateFilter(filter)).toMatch(
      /Multiple "_and" groups at the same level/,
    );
  });
});

describe('validationSchemas — duplicate _exists detection', () => {
  it('fails when two _exists nodes are siblings in an _implicit group', async () => {
    const filter = group('_implicit', [
      existsNode(
        'public',
        'users',
        group('_implicit', [condition('id', '_eq')]),
      ),
      existsNode(
        'public',
        'posts',
        group('_implicit', [condition('id', '_eq')]),
      ),
    ]);
    expect(await validateFilter(filter)).toMatch(
      /Multiple "_exists" conditions at the same level/,
    );
  });

  it('passes when a single _exists is in an _implicit group', async () => {
    const filter = group('_implicit', [
      existsNode(
        'public',
        'users',
        group('_implicit', [condition('id', '_eq')]),
      ),
      condition('col', '_eq'),
    ]);
    expect(await validateFilter(filter)).toBeNull();
  });

  it('passes when two _exists nodes are inside an _and parent', async () => {
    const filter = group('_and', [
      existsNode(
        'public',
        'users',
        group('_implicit', [condition('id', '_eq')]),
      ),
      existsNode(
        'public',
        'posts',
        group('_implicit', [condition('id', '_eq')]),
      ),
    ]);
    expect(await validateFilter(filter)).toBeNull();
  });
});

describe('validationSchemas — duplicate relationship detection', () => {
  it('fails when two relationship nodes with the same root are siblings in an _implicit group', async () => {
    const filter = group('_implicit', [
      relationshipNode('author', group('_implicit', [condition('id', '_eq')])),
      relationshipNode(
        'author',
        group('_implicit', [condition('name', '_eq')]),
      ),
    ]);
    expect(await validateFilter(filter)).toMatch(
      /Multiple conditions on relationship "author" at the same level/,
    );
  });

  it('passes when two relationship nodes have different roots', async () => {
    const filter = group('_implicit', [
      relationshipNode('author', group('_implicit', [condition('id', '_eq')])),
      relationshipNode(
        'category',
        group('_implicit', [condition('id', '_eq')]),
      ),
    ]);
    expect(await validateFilter(filter)).toBeNull();
  });

  it('passes when same relationship appears inside an _and parent', async () => {
    const filter = group('_and', [
      relationshipNode('author', group('_implicit', [condition('id', '_eq')])),
      relationshipNode(
        'author',
        group('_implicit', [condition('name', '_eq')]),
      ),
    ]);
    expect(await validateFilter(filter)).toBeNull();
  });

  it('fails when duplicate relationships are nested inside a relationship child', async () => {
    const filter = group('_implicit', [
      relationshipNode(
        'author',
        group('_implicit', [
          relationshipNode(
            'posts',
            group('_implicit', [condition('id', '_eq')]),
          ),
          relationshipNode(
            'posts',
            group('_implicit', [condition('title', '_eq')]),
          ),
        ]),
      ),
    ]);
    expect(await validateFilter(filter)).toMatch(
      /Multiple conditions on relationship "posts" at the same level/,
    );
  });
});
