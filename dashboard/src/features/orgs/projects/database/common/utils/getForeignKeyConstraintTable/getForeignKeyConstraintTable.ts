import type {
  ForeignKeyConstraintOn,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';

/**
 * Reads the remote table out of a `foreign_key_constraint_on`. Only the
 * `{ table, column(s) }` shape names one; a bare column or column array means
 * the constraint lives on the current table.
 */
export default function getForeignKeyConstraintTable(
  constraint: ForeignKeyConstraintOn | undefined,
): QualifiedTable | undefined {
  if (
    !constraint ||
    typeof constraint === 'string' ||
    Array.isArray(constraint)
  ) {
    return undefined;
  }

  return constraint.table;
}
