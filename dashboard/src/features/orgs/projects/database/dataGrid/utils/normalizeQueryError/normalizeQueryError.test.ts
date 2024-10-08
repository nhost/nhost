import type { QueryError } from '@/features/database/dataGrid/types/dataBrowser';
import { POSTGRESQL_ERROR_CODES } from '@/features/database/dataGrid/utils/postgresqlConstants';
import normalizeQueryError from './normalizeQueryError';

const baseQueryError: QueryError = {
  code: 'postgres-error',
  error: 'query execution failed',
  path: '$[0]',
};

test('should return the root level error message if internal error is not present', () => {
  expect(normalizeQueryError(baseQueryError)).toBe('query execution failed');
});

test('should not extract any error messages if response is an empty object', () => {
  expect(normalizeQueryError({})).toBe('Unknown error occurred.');
});

test('should not extract any error messages if response is not a query error', () => {
  expect(normalizeQueryError({ errorCode: 2, status: 500 })).toBe(
    'Unknown error occurred.',
  );
});

test('should return the internal error message if response is a query error', () => {
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

test('should return the internal error description first if the query error is for existing dependent objects', () => {
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

test('should return the internal error description first if the query error is for an existing table', () => {
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

  const queryErrorWithoutDescription: QueryError = {
    ...baseQueryError,
    internal: {
      arguments: [],
      prepared: false,
      statement: 'CREATE TABLE public.new_authors (id uuid PRIMARY KEY);',
      error: {
        exec_status: 'FatalError',
        status_code: POSTGRESQL_ERROR_CODES.TABLE_ALREADY_EXISTS,
        message: 'table "new_authors" already exists',
      },
    },
  };

  expect(normalizeQueryError(queryErrorWithoutDescription)).toBe(
    'A table with this name already exists.',
  );
});

test('should return the internal error description first if the query error is for unique constraint violation', () => {
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
