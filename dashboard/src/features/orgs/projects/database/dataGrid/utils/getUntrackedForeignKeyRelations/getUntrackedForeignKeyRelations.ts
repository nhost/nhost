import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getSingularForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';

function hasForeignKeyRelationChanged(
  left: ForeignKeyRelation,
  right: ForeignKeyRelation,
): boolean {
  const leftSingular = getSingularForeignKeyRelation(left);
  const rightSingular = getSingularForeignKeyRelation(right);

  if (!leftSingular || !rightSingular) {
    return false;
  }

  return !(
    leftSingular.localColumn === rightSingular.localColumn &&
    left.referencedSchema === right.referencedSchema &&
    left.referencedTable === right.referencedTable &&
    leftSingular.remoteColumn === rightSingular.remoteColumn &&
    left.updateAction === right.updateAction &&
    left.deleteAction === right.deleteAction &&
    left.oneToOne === right.oneToOne
  );
}

function getUntrackedForeignKeyRelations(
  original?: ForeignKeyRelation[],
  updated?: ForeignKeyRelation[],
): ForeignKeyRelation[] {
  const updatedSingularRelations = (updated ?? []).filter(
    (relation) => getSingularForeignKeyRelation(relation) !== null,
  );

  if (isNotEmptyValue(updatedSingularRelations) && isEmptyValue(original)) {
    return updatedSingularRelations;
  }

  if (isEmptyValue(updatedSingularRelations)) {
    return [];
  }

  const originalMap = new Map<string, ForeignKeyRelation>();
  (original ?? []).forEach((relation) => {
    const singularRelation = getSingularForeignKeyRelation(relation);

    if (singularRelation) {
      originalMap.set(singularRelation.localColumn, relation);
    }
  });

  return updatedSingularRelations.filter((updatedRelation) => {
    const singularRelation = getSingularForeignKeyRelation(updatedRelation);

    if (!singularRelation) {
      return false;
    }

    const originalRelation = originalMap.get(singularRelation.localColumn);
    return (
      !originalRelation ||
      hasForeignKeyRelationChanged(originalRelation, updatedRelation)
    );
  });
}

export default getUntrackedForeignKeyRelations;
