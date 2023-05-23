import type { QueryError } from '@/features/database/dataGrid/types/dataBrowser';
import { POSTGRESQL_ERROR_CODES } from '@/features/database/dataGrid/utils/postgresqlConstants';

/**
 * Returns a normalized error message from a query error.
 *
 * @param responseData The response data from a Hasura query.
 * @returns The normalized error message.
 */
export default function normalizeQueryError(responseData: any): string {
  const unknownErrorMessage = 'Unknown error occurred.';

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
      return (
        queryError.internal.error.description ||
        'A table with this name already exists.'
      );
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
      const parsedMessage = JSON.parse(queryError.message) as QueryError;

      return normalizeQueryError(parsedMessage);
    } catch {
      return queryError.message;
    }
  }

  return unknownErrorMessage;
}
