import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getForeignKeyRelationSignature } from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyRelationSignature';

export default function isCompleteForeignKeyRelation(
  relation: ForeignKeyRelation,
): boolean {
  return getForeignKeyRelationSignature(relation) !== null;
}
