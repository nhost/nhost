import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import type {
  ForeignKeyRelation,
  HasuraMetadataRelationship,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { parseForeignKeyConstraintOn } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';
import { areStrArraysEqual } from '@/lib/utils';

export interface FetchExistingRelationshipsOptions {
  dataSource: string;
  schema: string;
  table: string;
  appUrl: string;
  adminSecret: string;
  foreignKeys: ForeignKeyRelation[];
}

export interface ExistingRelationshipState {
  relationshipMap: Map<string, ForeignKeyRelation>;
  relationshipNames: Set<string>;
}

/**
 * Find matching foreign key for relationships in the current table.
 * These relationships have foreign_key_constraint_on as a string (column name).
 */
function findMatchingForeignKeyForCurrentTable(
  relationship: HasuraMetadataRelationship,
  foreignKeys: ForeignKeyRelation[],
): ForeignKeyRelation | null {
  const parsedConstraint = parseForeignKeyConstraintOn(
    relationship.using.foreign_key_constraint_on,
  );

  if (!parsedConstraint || parsedConstraint.table) {
    return null;
  }

  return (
    foreignKeys.find((fk) =>
      areStrArraysEqual(fk.columns, parsedConstraint.columns),
    ) || null
  );
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
  const parsedConstraint = parseForeignKeyConstraintOn(
    relationship.using.foreign_key_constraint_on,
  );

  if (!parsedConstraint?.table) {
    return null;
  }

  const matchesTable =
    parsedConstraint.table.name === currentTable &&
    parsedConstraint.table.schema === currentSchema &&
    areStrArraysEqual(parsedConstraint.columns, foreignKey.columns);

  return matchesTable ? foreignKey : null;
}

/**
 * Fetches existing relationships from Hasura metadata based on foreign keys.
 * Returns a map of relationship names to their corresponding foreign key relations.
 *
 * @param options - Options including table info and foreign keys to match
 * @returns Map where key is relationship name and value is the foreign key relation
 */
export async function fetchExistingRelationshipState({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  foreignKeys,
}: FetchExistingRelationshipsOptions): Promise<ExistingRelationshipState> {
  const relationshipMap = new Map<string, ForeignKeyRelation>();
  const relationshipNames = new Set<string>();

  const metadataResponse = await fetchExportMetadata({
    appUrl,
    adminSecret,
  });

  const source = metadataResponse.metadata.sources?.find(
    (s) => s.name === dataSource,
  );

  if (!source?.tables) {
    return { relationshipMap, relationshipNames };
  }

  const tables = source.tables as unknown as HasuraMetadataTable[];

  const currentTable = tables.find(
    (t) => t.table.name === table && t.table.schema === schema,
  );

  const currentTableRelationships = [
    ...(currentTable?.object_relationships ?? []),
    ...(currentTable?.array_relationships ?? []),
  ];
  currentTableRelationships.forEach((relationship) => {
    relationshipNames.add(`${schema}.${table}.${relationship.name}`);
  });

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
    const referencedSchema = foreignKey.referencedSchema || schema;
    const referencedTable = tables?.find(
      (t) =>
        t.table.name === foreignKey.referencedTable &&
        t.table.schema === referencedSchema,
    );

    if (!referencedTable) {
      return;
    }

    [
      ...(referencedTable.object_relationships ?? []),
      ...(referencedTable.array_relationships ?? []),
    ].forEach((relationship) => {
      relationshipNames.add(
        `${referencedSchema}.${foreignKey.referencedTable}.${relationship.name}`,
      );
    });

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
        const key = `${referencedSchema}.${foreignKey.referencedTable}.${relationship.name}`;
        relationshipMap.set(key, matchingForeignKey);
      }
    });
  });

  return { relationshipMap, relationshipNames };
}

export default async function fetchExistingRelationships(
  options: FetchExistingRelationshipsOptions,
): Promise<Map<string, ForeignKeyRelation>> {
  return (await fetchExistingRelationshipState(options)).relationshipMap;
}
