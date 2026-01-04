import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';

function hasForeignKeyRelationChanged(
  fk1: ForeignKeyRelation,
  fk2: ForeignKeyRelation,
): boolean {
  return !(
    fk1.columnName === fk2.columnName &&
    fk1.referencedSchema === fk2.referencedSchema &&
    fk1.referencedTable === fk2.referencedTable &&
    fk1.referencedColumn === fk2.referencedColumn &&
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
    originalForeignKeyRelations.map((fk) => [fk.columnName, fk]),
  );

  updatedForeignKeyRelations.forEach((updatedFk) => {
    const originalFk = originalMap.get(updatedFk.columnName);

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
