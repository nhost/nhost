import type { UniqueConstraint } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  formatUniqueConstraintDefinition,
  prepareCreateUniqueConstraintQuery,
  prepareDropUniqueConstraintQuery,
  prepareRenameUniqueConstraintQuery,
  prepareUniqueConstraintDiffQueries,
} from '@/features/orgs/projects/database/dataGrid/utils/prepareUniqueConstraintQueries';

const baseVariables = {
  dataSource: 'default',
  schema: 'public',
  table: 'users',
};

function loadedConstraint(
  id: string,
  name: string,
  columns: string[],
): UniqueConstraint {
  return { id, originalName: name, name, columns };
}

describe('prepareUniqueConstraintQueries', () => {
  it('formats named and unnamed UNIQUE definitions with quoted identifiers', () => {
    expect(
      formatUniqueConstraintDefinition({
        name: 'users email "key"',
        columns: ['email address', 'tenant"id'],
      }),
    ).toBe(
      'CONSTRAINT "users email ""key""" UNIQUE ("email address","tenant""id")',
    );
    expect(
      formatUniqueConstraintDefinition({
        name: '',
        columns: ['email address'],
      }),
    ).toBe('UNIQUE ("email address")');
  });

  it('prepares named and unnamed create queries', () => {
    const named = prepareCreateUniqueConstraintQuery({
      ...baseVariables,
      uniqueConstraint: loadedConstraint('named', 'users email key', [
        'email address',
      ]),
    });
    const unnamed = prepareCreateUniqueConstraintQuery({
      ...baseVariables,
      uniqueConstraint: {
        id: 'draft',
        originalName: '',
        name: '',
        columns: ['email address'],
      },
    });

    expect(named.args.sql).toBe(
      'ALTER TABLE public.users ADD CONSTRAINT "users email key" UNIQUE ("email address");',
    );
    expect(unnamed.args.sql).toBe(
      'ALTER TABLE public.users ADD UNIQUE ("email address");',
    );
  });

  it('prepares quoted drop and rename queries without CASCADE', () => {
    const drop = prepareDropUniqueConstraintQuery({
      ...baseVariables,
      uniqueConstraint: loadedConstraint('loaded', 'users email "key"', [
        'email',
      ]),
    });
    const rename = prepareRenameUniqueConstraintQuery({
      ...baseVariables,
      originalName: 'users email "key"',
      name: 'renamed key',
    });

    expect(drop.args.sql).toBe(
      'ALTER TABLE public.users DROP CONSTRAINT "users email ""key""";',
    );
    expect(drop.args.sql).not.toContain('CASCADE');
    expect(rename.args.sql).toBe(
      'ALTER TABLE public.users RENAME CONSTRAINT "users email ""key""" TO "renamed key";',
    );
  });

  it('defaults omitted constraint arrays to an unchanged no-op', () => {
    expect(prepareUniqueConstraintDiffQueries(baseVariables)).toEqual([]);
  });

  it('emits no query for an unchanged loaded constraint', () => {
    const constraint = loadedConstraint('loaded', 'users_email_key', ['email']);

    expect(
      prepareUniqueConstraintDiffQueries({
        ...baseVariables,
        originalUniqueConstraints: [constraint],
        uniqueConstraints: [{ ...constraint }],
      }),
    ).toEqual([]);
  });

  it('adds drafts and drops removed constraints by stable identity', () => {
    const removed = loadedConstraint('removed', 'removed_key', ['old']);
    const draft: UniqueConstraint = {
      id: 'draft',
      originalName: '',
      name: '',
      columns: ['new'],
    };

    const queries = prepareUniqueConstraintDiffQueries({
      ...baseVariables,
      originalUniqueConstraints: [removed],
      uniqueConstraints: [draft],
    });

    expect(queries.map(({ args }) => args.sql)).toEqual([
      'ALTER TABLE public.users DROP CONSTRAINT removed_key;',
      'ALTER TABLE public.users ADD UNIQUE ("new");',
    ]);
  });

  it('rejects missing names on loaded constraints but permits unnamed drafts', () => {
    expect(() =>
      prepareUniqueConstraintDiffQueries({
        ...baseVariables,
        originalUniqueConstraints: [
          { id: 'loaded', originalName: '', name: '', columns: ['email'] },
        ],
      }),
    ).toThrow('Loaded UNIQUE constraints must have a name.');

    expect(() =>
      prepareUniqueConstraintDiffQueries({
        ...baseVariables,
        originalUniqueConstraints: [
          loadedConstraint('loaded', 'users_email_key', ['email']),
        ],
        uniqueConstraints: [
          {
            id: 'loaded',
            originalName: 'users_email_key',
            name: '',
            columns: ['email'],
          },
        ],
      }),
    ).toThrow('Loaded UNIQUE constraints must have a name.');
  });

  it('uses one direct query for a pure rename', () => {
    const original = loadedConstraint('loaded', 'old_key', ['email']);

    const queries = prepareUniqueConstraintDiffQueries({
      ...baseVariables,
      originalUniqueConstraints: [original],
      uniqueConstraints: [{ ...original, name: 'new_key' }],
    });

    expect(queries.map(({ args }) => args.sql)).toEqual([
      'ALTER TABLE public.users RENAME CONSTRAINT old_key TO new_key;',
    ]);
  });

  it('orders rename chains from the free target backwards', () => {
    const first = loadedConstraint('first', 'first_key', ['first']);
    const second = loadedConstraint('second', 'second_key', ['second']);

    const queries = prepareUniqueConstraintDiffQueries({
      ...baseVariables,
      originalUniqueConstraints: [first, second],
      uniqueConstraints: [
        { ...first, name: 'second_key' },
        { ...second, name: 'third_key' },
      ],
    });

    expect(queries.map(({ args }) => args.sql)).toEqual([
      'ALTER TABLE public.users RENAME CONSTRAINT second_key TO third_key;',
      'ALTER TABLE public.users RENAME CONSTRAINT first_key TO second_key;',
    ]);
  });

  it('uses a non-colliding temporary name for rename swaps', () => {
    const first = loadedConstraint('first', 'first_key', ['first']);
    const second = loadedConstraint('second', 'second_key', ['second']);
    const occupiedTemporaryName = loadedConstraint(
      'occupied',
      'first_key__nhost_tmp_1',
      ['third'],
    );

    const queries = prepareUniqueConstraintDiffQueries({
      ...baseVariables,
      originalUniqueConstraints: [first, second, occupiedTemporaryName],
      uniqueConstraints: [
        { ...first, name: 'second_key' },
        { ...second, name: 'first_key' },
        occupiedTemporaryName,
      ],
    });
    const sql = queries.map(({ args }) => args.sql);

    expect(sql).toHaveLength(3);
    expect(sql[0]).toMatch(
      /^ALTER TABLE public\.users RENAME CONSTRAINT first_key TO first_key__nhost_tmp_2;$/,
    );
    expect(sql[1]).toBe(
      'ALTER TABLE public.users RENAME CONSTRAINT second_key TO first_key;',
    );
    expect(sql[2]).toBe(
      'ALTER TABLE public.users RENAME CONSTRAINT first_key__nhost_tmp_2 TO second_key;',
    );
  });

  it('bounds temporary swap names by the PostgreSQL UTF-8 identifier limit', () => {
    const firstName = `${'é'.repeat(30)}a`;
    const secondName = `${'é'.repeat(30)}b`;
    const first = loadedConstraint('first', firstName, ['first']);
    const second = loadedConstraint('second', secondName, ['second']);

    const queries = prepareUniqueConstraintDiffQueries({
      ...baseVariables,
      originalUniqueConstraints: [first, second],
      uniqueConstraints: [
        { ...first, name: secondName },
        { ...second, name: firstName },
      ],
    });
    const firstSql = queries[0].args.sql;
    const temporaryName = firstSql.match(/ TO "([^"]+)";$/)?.[1];

    expect(temporaryName).toBeDefined();
    expect(new TextEncoder().encode(temporaryName).length).toBeLessThanOrEqual(
      63,
    );
    expect(temporaryName).not.toBe(firstName);
    expect(temporaryName).not.toBe(secondName);
  });

  it.each([
    ['membership', ['tenant', 'username']],
    ['order', ['email', 'tenant']],
  ])('drops and recreates a constraint after a %s change', (_, columns) => {
    const original = loadedConstraint('loaded', 'users_key', [
      'tenant',
      'email',
    ]);

    const queries = prepareUniqueConstraintDiffQueries({
      ...baseVariables,
      originalUniqueConstraints: [original],
      uniqueConstraints: [{ ...original, columns }],
    });

    expect(queries.map(({ args }) => args.sql)).toEqual([
      'ALTER TABLE public.users DROP CONSTRAINT users_key;',
      `ALTER TABLE public.users ADD CONSTRAINT users_key UNIQUE (${columns.join(',')});`,
    ]);
  });
});
