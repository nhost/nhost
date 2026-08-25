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
  parseForeignKeyConstraintOn,
  serializeForeignKeyConstraintOn,
} from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';
import { getForeignKeyPairSignature } from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';

/**
 * Derives a stable, column-based suffix used to disambiguate relationship names
 * that collide. Handles every `foreign_key_constraint_on` shape, including the
 * composite (array / `columns`) forms.
 */
function getConstraintColumnSuffix(
  constraintOn: HasuraMetadataRelationship['using']['foreign_key_constraint_on'],
): string | undefined {
  return parseForeignKeyConstraintOn(constraintOn)?.columns.join('_');
}

type CreateRelationshipOperation = {
  type: 'pg_create_object_relationship' | 'pg_create_array_relationship';
  args: HasuraMetadataRelationship & {
    source: string;
    table: { name: string; schema: string };
  };
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
  operations: CreateRelationshipOperation[],
): number[] {
  const nameIndexMap = new Map<string, number[]>();

  operations.forEach((op, index) => {
    const { name, table } = op.args;
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
  operations: CreateRelationshipOperation[],
  existingRelationshipNames: ReadonlySet<string>,
): CreateRelationshipOperation[] {
  const duplicateIndexes = new Set(findNonUniqueNameIndexes(operations));
  const reservedNames = new Set(existingRelationshipNames);

  return operations.map((operation, index) => {
    const { table, name } = operation.args;
    const keyPrefix = `${table.schema}.${table.name}.`;
    const columnSuffix = getConstraintColumnSuffix(
      operation.args.using.foreign_key_constraint_on,
    );
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
  side: ExistingRelationship['side'],
): boolean {
  const keyPrefix = `${tableSchema}.${tableName}.`;
  const pairSignature = getForeignKeyPairSignature(
    relation.columns,
    relation.referencedColumns,
  );
  if (!pairSignature) {
    return false;
  }

  return [...relationshipMap].some(([key, existingRelationship]) => {
    if (!key.startsWith(keyPrefix) || existingRelationship.side !== side) {
      return false;
    }

    const { foreignKey } = existingRelationship;
    return (
      foreignKey.referencedTable === relation.referencedTable &&
      (foreignKey.referencedSchema || sourceSchema) ===
        (relation.referencedSchema || sourceSchema) &&
      getForeignKeyPairSignature(
        foreignKey.columns,
        foreignKey.referencedColumns,
      ) === pairSignature
    );
  });
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
  const validForeignKeyRelations = unTrackedForeignKeyRelations.filter(
    (relation) =>
      relation.referencedTable.length > 0 &&
      getForeignKeyPairSignature(
        relation.columns,
        relation.referencedColumns,
      ) !== null,
  );
  if (validForeignKeyRelations.length !== unTrackedForeignKeyRelations.length) {
    return [];
  }
  if (validForeignKeyRelations.length === 0) {
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
      ...validForeignKeyRelations,
    ],
    schema,
    table,
  });

  const newRelationshipsOperations: CreateRelationshipOperation[] =
    validForeignKeyRelations.flatMap((newForeignKeyRelation) => {
      const referencedSchema = newForeignKeyRelation.referencedSchema || schema;
      const localConstraintOn = serializeForeignKeyConstraintOn(
        newForeignKeyRelation.columns,
      );
      const remoteConstraintOn = serializeForeignKeyConstraintOn(
        newForeignKeyRelation.columns,
        { name: table, schema },
      );
      if (!localConstraintOn || !remoteConstraintOn) {
        return [];
      }

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

      const operations: CreateRelationshipOperation[] = [];
      if (
        !hasExistingRelationshipForTable(
          existingRelationshipMap,
          schema,
          table,
          schema,
          newForeignKeyRelation,
          'local',
        )
      ) {
        operations.push(createOwnRelationshipOperation);
      }
      if (
        !hasExistingRelationshipForTable(
          existingRelationshipMap,
          referencedSchema,
          newForeignKeyRelation.referencedTable,
          schema,
          newForeignKeyRelation,
          'referenced',
        )
      ) {
        operations.push(createReferencedTableOperation);
      }

      return operations;
    });

  return updateRelationshipNames(
    newRelationshipsOperations,
    existingRelationshipNames,
  );
}
