import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getForeignKeyPairSignature } from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';

/** The relation's pair signature, or `null` when the relation is incomplete. */
export default function getForeignKeyRelationSignature(
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
