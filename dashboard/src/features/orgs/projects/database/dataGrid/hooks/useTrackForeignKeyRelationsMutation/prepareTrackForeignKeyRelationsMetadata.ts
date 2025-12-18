import type {
  ForeignKeyRelation,
  HasuraMetadataRelationship,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isNotEmptyValue } from '@/lib/utils';
import { plural, singular } from 'pluralize';
import fetchExistingRelationships from './fetchExistingRelationships';

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

function updateDuplicateRelationshipNames(
  operations: CreateRelationshipOperation[],
): CreateRelationshipOperation[] {
  const duplicateIndexes = new Set(findNonUniqueNameIndexes(operations));

  if (duplicateIndexes.size === 0) {
    return operations;
  }

  return operations.map((op, index) => {
    if (!duplicateIndexes.has(index)) {
      return op;
    }

    const columnName =
      typeof op.args.using.foreign_key_constraint_on === 'string'
        ? op.args.using.foreign_key_constraint_on
        : op.args.using.foreign_key_constraint_on?.column;

    if (!columnName) {
      return op;
    }

    return {
      ...op,
      args: {
        ...op.args,
        name: `${op.args.name}_${columnName}`,
      },
    };
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
  let existingRelationshipMaps: Map<string, ForeignKeyRelation> = new Map<
    string,
    ForeignKeyRelation
  >();
  if (isNotEmptyValue(trackedForeignKeyRelations)) {
    existingRelationshipMaps = await fetchExistingRelationships({
      dataSource,
      adminSecret,
      appUrl,
      foreignKeys: trackedForeignKeyRelations,
      schema,
      table,
    });
  }

  const newRelationshipsOperations: CreateRelationshipOperation[] =
    unTrackedForeignKeyRelations.flatMap((newForeignKeyRelation) => {
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
            foreign_key_constraint_on: newForeignKeyRelation.columnName,
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
            schema: newForeignKeyRelation.referencedSchema!,
          },
          using: {
            foreign_key_constraint_on: {
              column: newForeignKeyRelation.columnName,
              table: {
                name: table,
                schema,
              },
            },
          },
        },
      };

      return [createOwnRelationshipOperation, createReferencedTableOperation];
    });

  let deduplicatedRelationshipsOperations = updateDuplicateRelationshipNames(
    newRelationshipsOperations,
  );

  if (existingRelationshipMaps.size > 0) {
    deduplicatedRelationshipsOperations =
      deduplicatedRelationshipsOperations.map((relationshipOperation) => {
        const relationshipKey = `${relationshipOperation.args.table.schema}.${relationshipOperation.args.table.name}.${relationshipOperation.args.name}`;
        if (existingRelationshipMaps.has(relationshipKey)) {
          const columnName =
            typeof relationshipOperation.args.using
              .foreign_key_constraint_on === 'string'
              ? relationshipOperation.args.using.foreign_key_constraint_on
              : relationshipOperation.args.using.foreign_key_constraint_on
                  ?.column;
          return {
            ...relationshipOperation,
            args: {
              ...relationshipOperation.args,
              name: `${relationshipOperation.args.name}_${columnName}`,
            },
          };
        }
        return relationshipOperation;
      });
  }

  return deduplicatedRelationshipsOperations;
}
