import type {
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';

export interface FetchFunctionPreviewOptions
  extends MutationOrQueryBaseOptions {
  /**
   * Maximum number of rows to return (default: 20)
   */
  limit?: number;
  /**
   * Function parameters as an array of values
   */
  parameters?: (string | number | null)[];
}

export interface FunctionPreviewResult {
  columns: string[];
  rows: string[][];
  error: string | null;
}

export async function fetchFunctionPreview({
  dataSource,
  schema,
  table: functionName,
  appUrl,
  adminSecret,
  limit = 20,
  parameters = [],
}: FetchFunctionPreviewOptions): Promise<FunctionPreviewResult> {
  try {
    // Build parameter placeholders for format() function
    // format() uses %1$I for identifiers, %2$L for literals, %3$s for numbers
    // Order: %1$I (schema), %2$I (functionName), %3$L-%N$L (parameters), %N+1$s (limit)
    const paramPlaceholders =
      parameters.length > 0
        ? parameters.map((_, index) => `%${index + 3}$L`).join(', ')
        : '';

    // Build the query with parameters
    // Order: schema, functionName, ...parameters, limit
    const queryArgs = [
      schema,
      functionName,
      ...parameters.map((p) =>
        p === null || p === undefined ? null : String(p),
      ),
      limit.toString(),
    ];

    const paramPlaceholderIndex = parameters.length + 3;
    const sqlQuery =
      parameters.length > 0
        ? `SELECT row_to_json(row_data) as data FROM (
            SELECT * FROM %1$I.%2$I(${paramPlaceholders}) LIMIT %${paramPlaceholderIndex}$s
          ) row_data`
        : `SELECT row_to_json(row_data) as data FROM (
            SELECT * FROM %1$I.%2$I() LIMIT %3$s
          ) row_data`;

    const response = await fetch(`${appUrl}/v2/query`, {
      method: 'POST',
      headers: {
        'x-hasura-admin-secret': adminSecret,
      },
      body: JSON.stringify({
        args: [
          getPreparedReadOnlyHasuraQuery(dataSource, sqlQuery, ...queryArgs),
        ],
        type: 'bulk',
        version: 1,
      }),
    });

    const responseData: QueryResult<string[]>[] | QueryError =
      await response.json();

    if (!response.ok || 'error' in responseData) {
      if ('internal' in responseData) {
        const queryError = responseData as QueryError;
        return {
          columns: [],
          rows: [],
          error:
            queryError.internal?.error?.message ||
            'Failed to execute function preview.',
        };
      }

      if ('error' in responseData) {
        const queryError = responseData as QueryError;
        return {
          columns: [],
          rows: [],
          error: queryError.error || 'Failed to execute function preview.',
        };
      }
    }

    const [, ...rawResults] = responseData[0].result;

    if (rawResults.length === 0) {
      return {
        columns: [],
        rows: [],
        error: null,
      };
    }

    // Parse results and extract columns and rows
    const parsedRows = rawResults.map((rawData) => {
      const row = JSON.parse(rawData);
      return row;
    });

    // Extract columns from first row
    const columns = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];

    // Convert rows to string arrays
    const rows = parsedRows.map((row) =>
      columns.map((col) => {
        const value = row[col];
        return value === null || value === undefined ? '' : String(value);
      }),
    );

    return {
      columns,
      rows,
      error: null,
    };
  } catch (error) {
    return {
      columns: [],
      rows: [],
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error occurred while executing function preview.',
    };
  }
}
