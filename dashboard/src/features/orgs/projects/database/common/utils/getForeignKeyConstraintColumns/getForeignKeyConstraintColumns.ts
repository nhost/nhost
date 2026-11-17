import type { ForeignKeyConstraintOn } from '@/utils/hasura-api/generated/schemas';

/**
 * Reads the column list out of any `foreign_key_constraint_on` shape. Object
 * relationships carry local columns, array relationships remote ones.
 */
export default function getForeignKeyConstraintColumns(
  constraint: ForeignKeyConstraintOn,
): string[] {
  if (typeof constraint === 'string') {
    return [constraint];
  }

  if (Array.isArray(constraint)) {
    return constraint;
  }

  if ('columns' in constraint) {
    return constraint.columns ?? [];
  }

  if ('column' in constraint && constraint.column) {
    return [constraint.column];
  }

  return [];
}
