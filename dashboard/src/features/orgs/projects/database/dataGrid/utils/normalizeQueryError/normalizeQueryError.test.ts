import type {
  DatabaseTable,
  QueryError,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import normalizeQueryError from './normalizeQueryError';

const baseQueryError: QueryError = {
  code: 'postgres-error',
  error: 'query execution failed',
  path: '$[0]',
};

it('should return the root level error message if internal error is not present', () => {
  expect(normalizeQueryError(baseQueryError)).toBe('query execution failed');
});

it('should not extract any error messages if response is an empty object', () => {
  expect(normalizeQueryError({})).toBe('Unknown error occurred.');
});

it('should not extract any error messages if response is not a query error', () => {
  expect(normalizeQueryError({ errorCode: 2, status: 500 })).toBe(
    'Unknown error occurred.',
  );
});

it('should return the internal error message if response is a query error', () => {
  const queryError: QueryError = {
    ...baseQueryError,
    internal: {
      arguments: [],
      prepared: false,
      statement: 'ALTER TABLE "public"."test" DROP CONSTRAINT "test_pkey"',
      error: {
        exec_status: 'FatalError',
        status_code: 'some-postgres-status-code',
        message: 'relation "test" does not exist',
      },
    },
  };

  expect(normalizeQueryError(queryError)).toBe(
    'relation "test" does not exist',
  );
});

it('should return the internal error description first if the query error is for existing dependent objects', () => {
  const queryErrorWithDescription: QueryError = {
    ...baseQueryError,
    internal: {
      arguments: [],
      prepared: false,
      statement: 'DROP TABLE IF EXISTS public.new_authors;',
      error: {
        exec_status: 'FatalError',
        status_code: POSTGRESQL_ERROR_CODES.DEPENDENT_OBJECTS_STILL_EXIST,
        description:
          'constraint new_books_author_id_fkey on table new_books depends on table new_authors',
        message:
          'cannot drop table new_authors because other objects depend on it',
      },
    },
  };

  expect(normalizeQueryError(queryErrorWithDescription)).toBe(
    'constraint new_books_author_id_fkey on table new_books depends on table new_authors',
  );

  const queryErrorWithoutDescription: QueryError = {
    ...baseQueryError,
    internal: {
      arguments: [],
      prepared: false,
      statement: 'DROP TABLE IF EXISTS public.new_authors;',
      error: {
        exec_status: 'FatalError',
        status_code: POSTGRESQL_ERROR_CODES.DEPENDENT_OBJECTS_STILL_EXIST,
        message:
          'cannot drop table new_authors because other objects depend on it',
      },
    },
  };

  expect(normalizeQueryError(queryErrorWithoutDescription)).toBe(
    'cannot drop table new_authors because other objects depend on it',
  );
});

it('should return the internal error description first if the query error is for an existing table', () => {
  const queryErrorWithDescription: QueryError = {
    ...baseQueryError,
    internal: {
      arguments: [],
      prepared: false,
      statement: 'CREATE TABLE public.new_authors (id uuid PRIMARY KEY);',
      error: {
        exec_status: 'FatalError',
        status_code: POSTGRESQL_ERROR_CODES.TABLE_ALREADY_EXISTS,
        description: 'this table already exists',
        message: 'table "new_authors" already exists',
      },
    },
  };

  expect(normalizeQueryError(queryErrorWithDescription)).toBe(
    'this table already exists',
  );
});

function relationExistsError(name: string): QueryError {
  return {
    ...baseQueryError,
    internal: {
      arguments: [],
      prepared: false,
      statement: 'ALTER TABLE public.b ADD CONSTRAINT con_a UNIQUE (y);',
      error: {
        exec_status: 'FatalError',
        status_code: POSTGRESQL_ERROR_CODES.TABLE_ALREADY_EXISTS,
        message: `relation "${name}" already exists`,
      },
    },
  };
}

const table: DatabaseTable = {
  name: 'b',
  columns: [{ name: 'y', type: 'integer' }],
  primaryKey: [],
  uniqueKeys: [
    { name: 'b_y_key', columns: ['y'] },
    { newName: 'con_a', columns: ['y'] },
  ],
};

it('should report an existing table if the table name is taken', () => {
  expect(normalizeQueryError(relationExistsError('b'), { table })).toBe(
    'A table with this name already exists.',
  );
});

it('should report a taken name if a unique constraint the query adds uses it', () => {
  expect(normalizeQueryError(relationExistsError('con_a'), { table })).toBe(
    'The name "con_a" is already used in this schema. A unique constraint\'s name must be different from every table, view, index and unique constraint in the schema.',
  );
});

it('should return the Postgres message if the taken name is not one the query sets', () => {
  expect(normalizeQueryError(relationExistsError('b_y_key'), { table })).toBe(
    'relation "b_y_key" already exists',
  );
});

it('should recognise a taken name in a migration API error', () => {
  expect(
    normalizeQueryError(
      { message: JSON.stringify(relationExistsError('con_a')) },
      { table },
    ),
  ).toBe(
    'The name "con_a" is already used in this schema. A unique constraint\'s name must be different from every table, view, index and unique constraint in the schema.',
  );
});

it('should return the internal error description first if the query error is for unique constraint violation', () => {
  const queryErrorWithDescription: QueryError = {
    ...baseQueryError,
    internal: {
      arguments: [],
      prepared: false,
      statement:
        'INSERT INTO public.new_authors (id) VALUES (uuid_generate_v4());',
      error: {
        exec_status: 'FatalError',
        status_code: POSTGRESQL_ERROR_CODES.UNIQUE_VIOLATION,
        description: 'cannot insert duplicate key',
        message: 'duplicate key value violates unique constraint',
      },
    },
  };

  expect(normalizeQueryError(queryErrorWithDescription)).toBe(
    'cannot insert duplicate key',
  );

  const queryErrorWithoutDescription: QueryError = {
    ...baseQueryError,
    internal: {
      arguments: [],
      prepared: false,
      statement:
        'INSERT INTO public.new_authors (id) VALUES (uuid_generate_v4());',
      error: {
        exec_status: 'FatalError',
        status_code: POSTGRESQL_ERROR_CODES.UNIQUE_VIOLATION,
        message: 'duplicate key value violates unique constraint',
      },
    },
  };

  expect(normalizeQueryError(queryErrorWithoutDescription)).toBe(
    'Duplicate entry found.',
  );
});
