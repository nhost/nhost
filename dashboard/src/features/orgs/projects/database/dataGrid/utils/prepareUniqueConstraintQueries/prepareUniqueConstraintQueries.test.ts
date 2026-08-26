import type { UniqueConstraint } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  formatUniqueConstraintDefinition,
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
  return { id, originalName: name, name, columns, nullsNotDistinct: false };
}

describe('prepareUniqueConstraintQueries', () => {
  it('formats named and unnamed UNIQUE definitions with quoted identifiers', () => {
    expect(
      formatUniqueConstraintDefinition({
        name: 'users email "key"',
        columns: ['email address', 'tenant"id'],
        nullsNotDistinct: false,
      }),
    ).toBe(
      'CONSTRAINT "users email ""key""" UNIQUE ("email address","tenant""id")',
    );
    expect(
      formatUniqueConstraintDefinition({
        name: '',
        columns: ['email address'],
        nullsNotDistinct: false,
      }),
    ).toBe('UNIQUE ("email address")');
    expect(
      formatUniqueConstraintDefinition({
        name: 'users_email_key',
        columns: ['email'],
        nullsNotDistinct: true,
      }),
    ).toBe('CONSTRAINT users_email_key UNIQUE NULLS NOT DISTINCT (email)');
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
          {
            id: 'loaded',
            originalName: '',
            name: '',
            columns: ['email'],
            nullsNotDistinct: false,
          },
        ],
      }),
    ).toThrow('Loaded UNIQUE constraints must have a name.');
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
