/**
 * Formats a key's columns the way the Hasura console does: one column as is,
 * several in parentheses.
 */
export default function formatColumnList(columns: string[]) {
  return columns.length > 1 ? `(${columns.join(', ')})` : columns.join('');
}
