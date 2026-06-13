import { fetchMetadata } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import type {
  ForeignKeyRelation,
  HasuraMetadataRelationship,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { areStrArraysEqual } from '@/lib/utils';

export interface FetchExistingRelationshipsOptions {
  dataSource: string;
  schema: string;
  table: string;
  appUrl: string;
  adminSecret: string;
  foreignKeys: ForeignKeyRelation[];
}

/**
 * Find matching foreign key for relationships in the current table.
 * These relationships have foreign_key_constraint_on as a string (column name).
 */
function findMatchingForeignKeyForCurrentTable(
  relationship: HasuraMetadataRelationship,
  foreignKeys: ForeignKeyRelation[],
): ForeignKeyRelation | null {
  const constraintOn = relationship.using.foreign_key_constraint_on;

  if (typeof constraintOn === 'string') {
    return (
      foreignKeys.find(
        (fk) => fk.columns.length === 1 && fk.columns[0] === constraintOn,
      ) || null
    );
  }

  if (Array.isArray(constraintOn)) {
    return (
      foreignKeys.find((fk) => areStrArraysEqual(fk.columns, constraintOn)) ||
      null
    );
  }

  return null;
}

/**
 * Find matching foreign key for relationships in referenced tables.
 * These relationships have foreign_key_constraint_on as an object with column and table.
 */
function findMatchingForeignKeyForReferencedTable(
  relationship: HasuraMetadataRelationship,
  foreignKey: ForeignKeyRelation,
  currentSchema: string,
  currentTable: string,
): ForeignKeyRelation | null {
  const constraint = relationship.using.foreign_key_constraint_on;

  if (
    !constraint ||
    typeof constraint === 'string' ||
    Array.isArray(constraint)
  ) {
    return null;
  }

  const matchesColumns =
    'columns' in constraint
      ? areStrArraysEqual(constraint.columns, foreignKey.columns)
      : foreignKey.columns.length === 1 &&
        foreignKey.columns[0] === constraint.column;

  const matchesTable =
    constraint.table.name === currentTable &&
    constraint.table.schema === currentSchema &&
    matchesColumns;

  return matchesTable ? foreignKey : null;
}

/**
 * Fetches existing relationships from Hasura metadata based on foreign keys.
 * Returns a map of relationship names to their corresponding foreign key relations.
 *
 * @param options - Options including table info and foreign keys to match
 * @returns Map where key is relationship name and value is the foreign key relation
 */
export default async function fetchExistingRelationships({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  foreignKeys,
}: FetchExistingRelationshipsOptions): Promise<
  Map<string, ForeignKeyRelation>
> {
  const relationshipMap = new Map<string, ForeignKeyRelation>();

  const metadata = await fetchMetadata({
    dataSource,
    appUrl,
    adminSecret,
  });

  if (!metadata.tables) {
    return relationshipMap;
  }

  const currentTable = metadata.tables.find(
    (t) => t.table.name === table && t.table.schema === schema,
  );

  if (currentTable?.object_relationships) {
    currentTable.object_relationships.forEach((relationship) => {
      const matchingForeignKey = findMatchingForeignKeyForCurrentTable(
        relationship,
        foreignKeys,
      );

      if (matchingForeignKey) {
        const key = `${schema}.${table}.${relationship.name}`;
        relationshipMap.set(key, matchingForeignKey);
      }
    });
  }

  foreignKeys.forEach((foreignKey) => {
    const referencedTable = metadata.tables?.find(
      (t) =>
        t.table.name === foreignKey.referencedTable &&
        t.table.schema === foreignKey.referencedSchema,
    );

    if (!referencedTable) {
      return;
    }

    const relationshipsToCheck = foreignKey.oneToOne
      ? referencedTable.object_relationships
      : referencedTable.array_relationships;

    if (!relationshipsToCheck) {
      return;
    }

    relationshipsToCheck.forEach((relationship) => {
      const matchingForeignKey = findMatchingForeignKeyForReferencedTable(
        relationship,
        foreignKey,
        schema,
        table,
      );

      if (matchingForeignKey) {
        const key = `${foreignKey.referencedSchema}.${foreignKey.referencedTable}.${relationship.name}`;
        relationshipMap.set(key, matchingForeignKey);
      }
    });
  });

  return relationshipMap;
}
