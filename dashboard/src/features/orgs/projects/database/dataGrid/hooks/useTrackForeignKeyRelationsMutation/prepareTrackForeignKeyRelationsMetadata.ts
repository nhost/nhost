import { plural, singular } from 'pluralize';
import {
  type ExistingRelationship,
  fetchExistingRelationshipState,
} from '@/features/orgs/projects/database/dataGrid/hooks/useTrackForeignKeyRelationsMutation/fetchExistingRelationships';
import type {
  ForeignKeyRelation,
  HasuraMetadataRelationship,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  getForeignKeyRelationSignature,
  isCompleteForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';
import { serializeForeignKeyConstraintOn } from '@/features/orgs/projects/database/dataGrid/utils/parseRelationshipUsing';

type CreateRelationshipOperation = {
  type: 'pg_create_object_relationship' | 'pg_create_array_relationship';
  args: HasuraMetadataRelationship & {
    source: string;
    table: { name: string; schema: string };
  };
};

type PlannedRelationshipOperation = {
  operation: CreateRelationshipOperation;
  /** Column-based suffix that disambiguates colliding relationship names. */
  columnSuffix: string;
};

export interface PrepareTrackForeignKeyRelationsMetadataVariables
  extends MutationOrQueryBaseOptions {
  /**
   * Foreign key relation to track.
   */
  trackedForeignKeyRelations?: ForeignKeyRelation[];
  /**
   * Foreign key relation to track.
   */
  unTrackedForeignKeyRelations: ForeignKeyRelation[];
}

function findNonUniqueNameIndexes(
  operations: PlannedRelationshipOperation[],
): number[] {
  const nameIndexMap = new Map<string, number[]>();

  operations.forEach(({ operation }, index) => {
    const { name, table } = operation.args;
    const key = `${table.schema}.${table.name}.${name}`;

    const indexes = nameIndexMap.get(key) || [];
    indexes.push(index);
    nameIndexMap.set(key, indexes);
  });

  const duplicateIndexes: number[] = [];
  nameIndexMap.forEach((indexes) => {
    if (indexes.length > 1) {
      duplicateIndexes.push(...indexes);
    }
  });

  return duplicateIndexes.sort((a, b) => a - b);
}

function updateRelationshipNames(
  operations: PlannedRelationshipOperation[],
  existingRelationshipNames: ReadonlySet<string>,
): CreateRelationshipOperation[] {
  const duplicateIndexes = new Set(findNonUniqueNameIndexes(operations));
  const reservedNames = new Set(existingRelationshipNames);

  return operations.map(({ operation, columnSuffix }, index) => {
    const { table, name } = operation.args;
    const keyPrefix = `${table.schema}.${table.name}.`;
    let candidateName = name;

    if (
      columnSuffix &&
      (duplicateIndexes.has(index) || reservedNames.has(`${keyPrefix}${name}`))
    ) {
      candidateName = `${name}_${columnSuffix}`;
    }

    const initialCandidateName = candidateName;
    let collisionIndex = 2;
    while (reservedNames.has(`${keyPrefix}${candidateName}`)) {
      candidateName = `${initialCandidateName}_${collisionIndex}`;
      collisionIndex += 1;
    }
    reservedNames.add(`${keyPrefix}${candidateName}`);

    if (candidateName === name) {
      return operation;
    }

    return {
      ...operation,
      args: { ...operation.args, name: candidateName },
    };
  });
}

function hasExistingRelationshipForTable(
  relationshipMap: ReadonlyMap<string, ExistingRelationship>,
  tableSchema: string,
  tableName: string,
  sourceSchema: string,
  relation: ForeignKeyRelation,
  pairSignature: string,
  side: ExistingRelationship['side'],
): boolean {
  const keyPrefix = `${tableSchema}.${tableName}.`;

  for (const [key, existingRelationship] of relationshipMap) {
    if (!key.startsWith(keyPrefix) || existingRelationship.side !== side) {
      continue;
    }

    const { foreignKey } = existingRelationship;
    if (
      foreignKey.referencedTable === relation.referencedTable &&
      (foreignKey.referencedSchema || sourceSchema) ===
        (relation.referencedSchema || sourceSchema) &&
      getForeignKeyRelationSignature(foreignKey) === pairSignature
    ) {
      return true;
    }
  }

  return false;
}

export default async function prepareTrackForeignKeyRelationsMetadata({
  dataSource,
  schema,
  table,
  adminSecret,
  appUrl,
  unTrackedForeignKeyRelations,
  trackedForeignKeyRelations,
}: PrepareTrackForeignKeyRelationsMetadataVariables) {
  if (
    unTrackedForeignKeyRelations.length === 0 ||
    !unTrackedForeignKeyRelations.every(isCompleteForeignKeyRelation)
  ) {
    return [];
  }

  const {
    relationshipMap: existingRelationshipMap,
    relationshipNames: existingRelationshipNames,
  } = await fetchExistingRelationshipState({
    dataSource,
    adminSecret,
    appUrl,
    foreignKeys: [
      ...(trackedForeignKeyRelations ?? []),
      ...unTrackedForeignKeyRelations,
    ],
    schema,
    table,
  });

  const newRelationshipsOperations: PlannedRelationshipOperation[] =
    unTrackedForeignKeyRelations.flatMap((newForeignKeyRelation) => {
      const referencedSchema = newForeignKeyRelation.referencedSchema || schema;
      const pairSignature = getForeignKeyRelationSignature(
        newForeignKeyRelation,
      );
      const localConstraintOn = serializeForeignKeyConstraintOn(
        newForeignKeyRelation.columns,
      );
      const remoteConstraintOn = serializeForeignKeyConstraintOn(
        newForeignKeyRelation.columns,
        { name: table, schema },
      );
      if (!pairSignature || !localConstraintOn || !remoteConstraintOn) {
        return [];
      }

      const columnSuffix = newForeignKeyRelation.columns.join('_');

      const createOwnRelationshipOperation: CreateRelationshipOperation = {
        type: 'pg_create_object_relationship',
        args: {
          name: singular(newForeignKeyRelation.referencedTable),
          source: dataSource,
          table: {
            name: table,
            schema,
          },
          using: {
            foreign_key_constraint_on: localConstraintOn,
          },
        },
      };

      const createReferencedTableOperation: CreateRelationshipOperation = {
        type: newForeignKeyRelation.oneToOne
          ? 'pg_create_object_relationship'
          : 'pg_create_array_relationship',
        args: {
          name: newForeignKeyRelation.oneToOne
            ? singular(table)
            : plural(table),
          source: dataSource,
          table: {
            name: newForeignKeyRelation.referencedTable,
            schema: referencedSchema,
          },
          using: {
            foreign_key_constraint_on: remoteConstraintOn,
          },
        },
      };

      const operations: PlannedRelationshipOperation[] = [];
      if (
        !hasExistingRelationshipForTable(
          existingRelationshipMap,
          schema,
          table,
          schema,
          newForeignKeyRelation,
          pairSignature,
          'local',
        )
      ) {
        operations.push({
          operation: createOwnRelationshipOperation,
          columnSuffix,
        });
      }
      if (
        !hasExistingRelationshipForTable(
          existingRelationshipMap,
          referencedSchema,
          newForeignKeyRelation.referencedTable,
          schema,
          newForeignKeyRelation,
          pairSignature,
          'referenced',
        )
      ) {
        operations.push({
          operation: createReferencedTableOperation,
          columnSuffix,
        });
      }

      return operations;
    });

  return updateRelationshipNames(
    newRelationshipsOperations,
    existingRelationshipNames,
  );
}
