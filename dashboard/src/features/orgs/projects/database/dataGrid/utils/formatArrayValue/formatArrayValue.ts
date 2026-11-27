import { format } from 'node-pg-format';

/**
 * Formats an array value, entered as JSON-array text, as a PostgreSQL array
 * expression. An empty array is written as the `'{}'` literal: PostgreSQL
 * cannot infer the element type of `ARRAY[]`, but casts `'{}'` to the
 * column's array type.
 *
 * @param columnId - Column the value belongs to, named in the error.
 * @param value - JSON-array text, e.g. `["a", "b"]`.
 * @returns The SQL expression for the array.
 * @throws {Error} When the value is not valid JSON.
 */
export default function formatArrayValue(
  columnId: string,
  value: string,
): string {
  let elements: unknown;

  try {
    elements = JSON.parse(value);
  } catch {
    throw new Error(
      `Invalid array value for column "${columnId}". Use JSON array format, e.g. [1, 2, 3].`,
    );
  }

  if (Array.isArray(elements) && elements.length === 0) {
    return format('%L', '{}');
  }

  return format('ARRAY[%L]', elements);
}
