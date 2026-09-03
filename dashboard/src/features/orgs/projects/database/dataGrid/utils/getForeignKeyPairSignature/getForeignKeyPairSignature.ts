import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  canonicalizeColumnPairs,
  zipRelationshipColumnPairs,
} from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';

/**
 * Order-insensitive signature of a foreign key's column pairs (`columns[i]` →
 * `referencedColumns[i]`). Reordering the pairs keeps the signature; a
 * different pairing of the same columns changes it.
 */
export default function getForeignKeyPairSignature(
  columns: string[],
  referencedColumns: string[],
): string | null {
  const pairs = zipRelationshipColumnPairs(columns, referencedColumns);
  return pairs ? JSON.stringify(canonicalizeColumnPairs(pairs)) : null;
}

/** The relation's pair signature, or `null` when the relation is incomplete. */
export function getForeignKeyRelationSignature(
  relation: ForeignKeyRelation,
): string | null {
  if (!relation.referencedTable) {
    return null;
  }

  return getForeignKeyPairSignature(
    relation.columns,
    relation.referencedColumns,
  );
}

export function isCompleteForeignKeyRelation(
  relation: ForeignKeyRelation,
): boolean {
  return getForeignKeyRelationSignature(relation) !== null;
}

export function areForeignKeyRelationsEqual(
  first: ForeignKeyRelation,
  second: ForeignKeyRelation,
): boolean {
  const firstSignature = getForeignKeyPairSignature(
    first.columns,
    first.referencedColumns,
  );
  const secondSignature = getForeignKeyPairSignature(
    second.columns,
    second.referencedColumns,
  );

  return (
    first.name === second.name &&
    first.referencedSchema === second.referencedSchema &&
    first.referencedTable === second.referencedTable &&
    firstSignature !== null &&
    firstSignature === secondSignature &&
    first.updateAction === second.updateAction &&
    first.deleteAction === second.deleteAction
  );
}
