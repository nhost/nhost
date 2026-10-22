import type {
  DatabaseTable,
  QueryError,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

export interface NormalizeQueryErrorOptions {
  /**
   * Table the query creates or updates. Lets a name clash be reported
   * against the table name or a UNIQUE constraint the query adds.
   */
  table?: DatabaseTable;
}

/**
 * Returns a normalized error message from a query error.
 *
 * @param responseData The response data from a Hasura query.
 * @param options Context of the query that failed.
 * @returns The normalized error message.
 */
export default function normalizeQueryError(
  responseData: unknown,
  { table }: NormalizeQueryErrorOptions = {},
): string {
  const unknownErrorMessage = 'Unknown error occurred.';

  if (typeof responseData !== 'object' || responseData === null) {
    return unknownErrorMessage;
  }

  if ('internal' in responseData) {
    const queryError = responseData as QueryError;

    if (
      queryError.internal?.error?.status_code ===
      POSTGRESQL_ERROR_CODES.DEPENDENT_OBJECTS_STILL_EXIST
    ) {
      return (
        queryError.internal.error.description ||
        queryError.internal.error.message ||
        unknownErrorMessage
      );
    }

    if (
      queryError.internal?.error?.status_code ===
      POSTGRESQL_ERROR_CODES.TABLE_ALREADY_EXISTS
    ) {
      const { description, message } = queryError.internal.error;
      // Postgres names the relation that already exists, not what it is.
      // Tables, views, indexes and UNIQUE constraints (through their index)
      // share one set of names per schema, so only our own names are known.
      const isNameTaken = (name?: string) =>
        Boolean(name) && message === `relation "${name}" already exists`;
      const takenUniqueKeyName = table?.uniqueKeys?.find(
        ({ name, newName }) => !name && isNameTaken(newName),
      )?.newName;

      if (description) {
        return description;
      }

      if (isNameTaken(table?.name)) {
        return 'A table with this name already exists.';
      }

      if (takenUniqueKeyName) {
        return `The name "${takenUniqueKeyName}" is already used in this schema. A unique constraint's name must be different from every table, view, index and unique constraint in the schema.`;
      }

      return message || unknownErrorMessage;
    }

    if (
      queryError.internal?.error?.status_code ===
      POSTGRESQL_ERROR_CODES.UNIQUE_VIOLATION
    ) {
      return queryError.internal.error.description || 'Duplicate entry found.';
    }

    return queryError.internal?.error?.message || unknownErrorMessage;
  }

  if ('error' in responseData) {
    return (responseData as QueryError).error;
  }

  // Note: Migration API returns a different error format.
  if ('message' in responseData) {
    const queryError = responseData as QueryError;

    try {
      const parsedMessage = JSON.parse(
        queryError.message as string,
      ) as QueryError;

      return normalizeQueryError(parsedMessage, { table });
    } catch {
      return queryError.message || '';
    }
  }

  return unknownErrorMessage;
}
