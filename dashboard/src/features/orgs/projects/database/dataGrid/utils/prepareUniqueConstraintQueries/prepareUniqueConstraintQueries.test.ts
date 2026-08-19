import type { UniqueConstraint } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  formatUniqueConstraintDefinition,
  prepareCreateUniqueConstraintQuery,
  prepareDropUniqueConstraintQuery,
  prepareRenameUniqueConstraintQuery,
  prepareUniqueConstraintRenameQueries,
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
    expect(prepareUniqueConstraintRenameQueries(baseVariables)).toEqual([]);
  });

  it('emits no query for an unchanged loaded constraint', () => {
    const constraint = loadedConstraint('loaded', 'users_email_key', ['email']);

    expect(
      prepareUniqueConstraintRenameQueries({
        ...baseVariables,
        originalUniqueConstraints: [constraint],
        uniqueConstraints: [{ ...constraint }],
      }),
    ).toEqual([]);
  });

  it('rejects missing names on loaded constraints', () => {
    expect(() =>
      prepareUniqueConstraintRenameQueries({
        ...baseVariables,
        originalUniqueConstraints: [
          { id: 'loaded', originalName: '', name: '', columns: ['email'] },
        ],
      }),
    ).toThrow('Loaded UNIQUE constraints must have a name.');

    expect(() =>
      prepareUniqueConstraintRenameQueries({
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

    const queries = prepareUniqueConstraintRenameQueries({
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

    const queries = prepareUniqueConstraintRenameQueries({
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
      '__nhost_tmp_1',
      ['third'],
    );

    const queries = prepareUniqueConstraintRenameQueries({
      ...baseVariables,
      originalUniqueConstraints: [first, second, occupiedTemporaryName],
      uniqueConstraints: [
        { ...first, name: 'second_key' },
        { ...second, name: 'first_key' },
        occupiedTemporaryName,
      ],
    });

    expect(queries.map(({ args }) => args.sql)).toEqual([
      'ALTER TABLE public.users RENAME CONSTRAINT first_key TO __nhost_tmp_2;',
      'ALTER TABLE public.users RENAME CONSTRAINT second_key TO first_key;',
      'ALTER TABLE public.users RENAME CONSTRAINT __nhost_tmp_2 TO second_key;',
    ]);
  });
});
