import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { getForeignKeyConstraintColumns } from '@/features/orgs/projects/database/common/utils/getForeignKeyConstraintColumns';
import type {
  ForeignKeyRelation,
  HasuraMetadataRelationship,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isFKConstraintOnSameTable } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import { formatForeignKeyColumns } from '@/features/orgs/projects/database/dataGrid/utils/formatForeignKeyColumns';
import { areStrArraysEqualOrdered } from '@/lib/utils';

export interface FetchExistingRelationshipsOptions {
  dataSource: string;
  schema: string;
  table: string;
  appUrl: string;
  adminSecret: string;
  foreignKeys: ForeignKeyRelation[];
}

/**
 * Find the foreign key behind a relationship whose constraint sits on the
 * current table, i.e. the declaring table owns the referencing column(s).
 */
function findMatchingForeignKeyForCurrentTable(
  relationship: HasuraMetadataRelationship,
  foreignKeys: ForeignKeyRelation[],
): ForeignKeyRelation | null {
  const constraint = relationship.using.foreign_key_constraint_on;

  if (!isFKConstraintOnSameTable(constraint)) {
    return null;
  }

  const constraintColumns = getForeignKeyConstraintColumns(constraint);

  return (
    foreignKeys.find((fk) =>
      areStrArraysEqualOrdered(
        formatForeignKeyColumns(fk.columnName),
        constraintColumns,
      ),
    ) || null
  );
}

/**
 * Find the foreign key behind a relationship declared on the referenced table,
 * whose constraint points back at the current table. Covers array
 * relationships and the one-to-one object relationships that mirror them.
 */
function findMatchingForeignKeyForReferencedTable(
  relationship: HasuraMetadataRelationship,
  foreignKey: ForeignKeyRelation,
  currentSchema: string,
  currentTable: string,
): ForeignKeyRelation | null {
  const constraint = relationship.using.foreign_key_constraint_on;

  if (!constraint || isFKConstraintOnSameTable(constraint)) {
    return null;
  }

  const matchesTable =
    constraint.table?.name === currentTable &&
    constraint.table?.schema === currentSchema;
  const matchesColumns = areStrArraysEqualOrdered(
    formatForeignKeyColumns(foreignKey.columnName),
    getForeignKeyConstraintColumns(constraint),
  );

  return matchesTable && matchesColumns ? foreignKey : null;
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

  const metadataResponse = await fetchExportMetadata({
    appUrl,
    adminSecret,
  });

  const source = metadataResponse.metadata.sources?.find(
    (s) => s.name === dataSource,
  );

  if (!source?.tables) {
    return relationshipMap;
  }

  const tables = source.tables as unknown as HasuraMetadataTable[];

  const currentTable = tables.find(
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
    const referencedTable = tables?.find(
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
