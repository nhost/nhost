import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';
import isComputedFieldFunction from './isComputedFieldFunction';

const usersTable: QualifiedTable = { name: 'users', schema: 'public' };

const buildFn = (
  overrides: Partial<PostgresFunction> = {},
): PostgresFunction => ({
  function_schema: 'public',
  function_name: 'compute_something',
  function_arguments: '',
  function_definition: '',
  input_arg_types: [],
  ...overrides,
});

describe('isComputedFieldFunction', () => {
  it('accepts a function whose only argument is the table row', () => {
    const fn = buildFn({
      input_arg_types: [{ schema: 'public', name: 'users', type: 'c' }],
    });

    expect(isComputedFieldFunction(fn, usersTable)).toBe(true);
  });

  it('accepts a function whose extra arguments are scalar', () => {
    const fn = buildFn({
      input_arg_types: [
        { schema: 'public', name: 'users', type: 'c' },
        { schema: 'pg_catalog', name: 'text', type: 'b' },
        { schema: 'pg_catalog', name: 'int4', type: 'b' },
      ],
    });

    expect(isComputedFieldFunction(fn, usersTable)).toBe(true);
  });

  it('rejects a function that does not take the table row', () => {
    const fn = buildFn({
      input_arg_types: [
        { schema: 'public', name: 'orders', type: 'c' },
        { schema: 'pg_catalog', name: 'text', type: 'b' },
      ],
    });

    expect(isComputedFieldFunction(fn, usersTable)).toBe(false);
  });

  it('rejects a function with a pseudo-typed argument such as `internal`', () => {
    const fn = buildFn({
      input_arg_types: [
        { schema: 'public', name: 'users', type: 'c' },
        { schema: 'pg_catalog', name: 'internal', type: 'p' },
      ],
    });

    expect(isComputedFieldFunction(fn, usersTable)).toBe(false);
  });

  it.each([
    ['enum', 'e'],
    ['domain', 'd'],
    ['range', 'r'],
  ])('rejects a function with a %s argument', (_label, type) => {
    const fn = buildFn({
      input_arg_types: [
        { schema: 'public', name: 'users', type: 'c' },
        { schema: 'public', name: 'mood', type },
      ],
    });

    expect(isComputedFieldFunction(fn, usersTable)).toBe(false);
  });

  it('rejects a same-named row that lives in a different schema', () => {
    const fn = buildFn({
      input_arg_types: [{ schema: 'auth', name: 'users', type: 'c' }],
    });

    expect(isComputedFieldFunction(fn, usersTable)).toBe(false);
  });

  it('rejects functions that take no arguments', () => {
    expect(isComputedFieldFunction(buildFn(), usersTable)).toBe(false);
  });
});
