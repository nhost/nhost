import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getForeignKeyPairSignature } from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';

interface ValidForeignKeyRelation {
  relation: ForeignKeyRelation;
  pairSignature: string;
  localColumnSignature: string;
}

function validateRelation(
  relation: ForeignKeyRelation,
): ValidForeignKeyRelation | null {
  const pairSignature = getForeignKeyPairSignature(
    relation.columns,
    relation.referencedColumns,
  );
  if (!pairSignature || !relation.referencedTable) {
    return null;
  }

  return {
    relation,
    pairSignature,
    localColumnSignature: JSON.stringify([...relation.columns].sort()),
  };
}

function hasForeignKeyRelationChanged(
  original: ValidForeignKeyRelation,
  updated: ValidForeignKeyRelation,
): boolean {
  return (
    original.pairSignature !== updated.pairSignature ||
    original.relation.referencedSchema !== updated.relation.referencedSchema ||
    original.relation.referencedTable !== updated.relation.referencedTable ||
    original.relation.updateAction !== updated.relation.updateAction ||
    original.relation.deleteAction !== updated.relation.deleteAction ||
    original.relation.oneToOne !== updated.relation.oneToOne
  );
}

function getTrackingIdentity({
  relation,
  pairSignature,
}: ValidForeignKeyRelation): string {
  return JSON.stringify([
    relation.referencedSchema ?? null,
    relation.referencedTable,
    pairSignature,
  ]);
}

function getUntrackedForeignKeyRelations(
  original?: ForeignKeyRelation[],
  updated?: ForeignKeyRelation[],
): ForeignKeyRelation[] {
  const originalRelations = (original ?? []).flatMap((relation) => {
    const validated = validateRelation(relation);
    return validated ? [validated] : [];
  });
  const originalByName = new Map(
    originalRelations.flatMap((validated) =>
      validated.relation.name
        ? [[validated.relation.name, validated] as const]
        : [],
    ),
  );
  const seenTrackingIdentities = new Set<string>();

  return (updated ?? []).flatMap((relation) => {
    const validated = validateRelation(relation);
    if (!validated) {
      return [];
    }

    const trackingIdentity = getTrackingIdentity(validated);
    if (seenTrackingIdentities.has(trackingIdentity)) {
      return [];
    }
    seenTrackingIdentities.add(trackingIdentity);

    const originalRelation =
      (relation.name ? originalByName.get(relation.name) : undefined) ??
      originalRelations.find(
        (candidate) =>
          candidate.localColumnSignature === validated.localColumnSignature,
      );

    if (
      originalRelation &&
      !hasForeignKeyRelationChanged(originalRelation, validated)
    ) {
      return [];
    }

    return [relation];
  });
}

export default getUntrackedForeignKeyRelations;
