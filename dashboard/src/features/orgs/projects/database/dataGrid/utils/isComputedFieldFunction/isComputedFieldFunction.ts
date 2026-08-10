import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';

/**
 * Determines whether a Postgres function can back a computed field on the
 * given table. The function must receive the table's row type as input,
 * and every input argument must be either a base scalar (`b`) or a
 * composite (`c`) type — anything else (pseudo, enum, domain, range) is
 * rejected.
 */
export default function isComputedFieldFunction(
  fn: PostgresFunction,
  table: QualifiedTable,
): boolean {
  const args = fn.input_arg_types ?? [];
  if (args.length === 0) {
    return false;
  }

  let acceptsTableRow = false;

  for (const arg of args) {
    if (arg.type !== 'b' && arg.type !== 'c') {
      return false;
    }
    if (arg.name === table.name && arg.schema === table.schema) {
      acceptsTableRow = true;
    }
  }

  return acceptsTableRow;
}
