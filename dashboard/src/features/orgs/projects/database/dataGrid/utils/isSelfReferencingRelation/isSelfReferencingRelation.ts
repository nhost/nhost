import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

/** An empty `referencedSchema` falls back to the table's own schema. */
export default function isSelfReferencingRelation(
  relation: ForeignKeyRelation,
  schema: string | undefined,
  tableName: string,
): boolean {
  return (
    (relation.referencedSchema || schema) === schema &&
    relation.referencedTable === tableName
  );
}
