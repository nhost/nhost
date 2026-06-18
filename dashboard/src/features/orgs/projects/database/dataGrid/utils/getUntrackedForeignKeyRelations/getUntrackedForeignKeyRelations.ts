import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getForeignKeyPairSignature } from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';

function hasForeignKeyRelationChanged(
  fk1: ForeignKeyRelation,
  fk2: ForeignKeyRelation,
): boolean {
  return !(
    getForeignKeyPairSignature(fk1.columns, fk1.referencedColumns) ===
      getForeignKeyPairSignature(fk2.columns, fk2.referencedColumns) &&
    fk1.referencedSchema === fk2.referencedSchema &&
    fk1.referencedTable === fk2.referencedTable &&
    fk1.updateAction === fk2.updateAction &&
    fk1.deleteAction === fk2.deleteAction &&
    fk1.oneToOne === fk2.oneToOne
  );
}

function getUntrackedForeignKeyRelations(
  original?: ForeignKeyRelation[],
  updated?: ForeignKeyRelation[],
): ForeignKeyRelation[] {
  if (isNotEmptyValue(updated) && isEmptyValue(original)) {
    return updated;
  }

  if (isEmptyValue(updated)) {
    return [];
  }
  const originalForeignKeyRelations = original as ForeignKeyRelation[];
  const updatedForeignKeyRelations = updated as ForeignKeyRelation[];
  let untrackedForeignKeyRelataions: ForeignKeyRelation[] = [];
  const originalMap = new Map(
    originalForeignKeyRelations.map((fk) => [
      getForeignKeyPairSignature(fk.columns, fk.referencedColumns),
      fk,
    ]),
  );

  updatedForeignKeyRelations.forEach((updatedFk) => {
    const originalFk = originalMap.get(
      getForeignKeyPairSignature(
        updatedFk.columns,
        updatedFk.referencedColumns,
      ),
    );

    if (
      (isNotEmptyValue(originalFk) &&
        hasForeignKeyRelationChanged(originalFk, updatedFk)) ||
      isEmptyValue(originalFk)
    ) {
      untrackedForeignKeyRelataions =
        untrackedForeignKeyRelataions.concat(updatedFk);
    }
  });

  return untrackedForeignKeyRelataions;
}

export default getUntrackedForeignKeyRelations;
