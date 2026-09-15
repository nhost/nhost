import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getForeignKeyPairSignature } from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';

export default function areForeignKeyRelationsEqual(
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
