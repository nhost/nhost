/**
 * Convert a 1-based page number into the row offset for a paginated query.
 *
 * @example
 * ```js
 * getPaginationOffset(1, 25) // 0
 * getPaginationOffset(2, 25) // 25
 * getPaginationOffset(3, 25) // 50
 * ```
 *
 * @param page - 1-based page number (values below 1 are treated as page 1)
 * @param pageSize - Number of rows per page
 * @returns Row offset to pass to the query
 */
export default function getPaginationOffset(
  page: number,
  pageSize: number,
): number {
  return (Math.max(page, 1) - 1) * pageSize;
}
