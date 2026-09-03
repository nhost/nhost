import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import type {
  ForeignKeyRelation,
  HasuraMetadataRelationship,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  getForeignKeyPairSignature,
  getForeignKeyRelationSignature,
} from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';
import { parseRelationshipUsing } from '@/features/orgs/projects/database/dataGrid/utils/parseRelationshipUsing';
import { areStrArraysEqual } from '@/lib/utils';

export interface FetchExistingRelationshipsOptions {
  dataSource: string;
  schema: string;
  table: string;
  appUrl: string;
  adminSecret: string;
  foreignKeys: ForeignKeyRelation[];
}

export type ExistingRelationship = {
  foreignKey: ForeignKeyRelation;
  side: 'local' | 'referenced';
};

export interface ExistingRelationshipState {
  relationshipMap: Map<string, ExistingRelationship>;
  relationshipNames: Set<string>;
}

function deduplicateValidForeignKeys(
  foreignKeys: readonly ForeignKeyRelation[],
  sourceSchema: string,
): ForeignKeyRelation[] {
  const uniqueForeignKeys = new Map<string, ForeignKeyRelation>();

  for (const foreignKey of foreignKeys) {
    const pairSignature = getForeignKeyRelationSignature(foreignKey);
    if (!pairSignature) {
      continue;
    }

    const identity = JSON.stringify([
      foreignKey.referencedSchema || sourceSchema,
      foreignKey.referencedTable,
      pairSignature,
    ]);
    if (!uniqueForeignKeys.has(identity)) {
      uniqueForeignKeys.set(identity, foreignKey);
    }
  }

  return [...uniqueForeignKeys.values()];
}

function getUniqueForeignKey(
  candidates: readonly ForeignKeyRelation[],
): ForeignKeyRelation | null {
  return candidates.length === 1 ? candidates[0] : null;
}

function findMatchingForeignKeyForCurrentTable(
  relationship: HasuraMetadataRelationship,
  foreignKeys: readonly ForeignKeyRelation[],
  currentSchema: string,
): ForeignKeyRelation | null {
  const configuration = parseRelationshipUsing(relationship.using);
  if (!configuration) {
    return null;
  }

  if (configuration.kind === 'foreignKeyConstraintOn') {
    const { constraintOn } = configuration;
    if (constraintOn.table) {
      return null;
    }

    return getUniqueForeignKey(
      foreignKeys.filter((foreignKey) =>
        areStrArraysEqual(foreignKey.columns, constraintOn.columns),
      ),
    );
  }

  const manual = configuration.configuration;
  const manualPairSignature = getForeignKeyPairSignature(
    manual.columnPairs.map(({ fromColumn }) => fromColumn),
    manual.columnPairs.map(({ toColumn }) => toColumn),
  );
  if (!manualPairSignature) {
    return null;
  }

  return getUniqueForeignKey(
    foreignKeys.filter(
      (foreignKey) =>
        manual.table.schema ===
          (foreignKey.referencedSchema ?? currentSchema) &&
        manual.table.name === foreignKey.referencedTable &&
        manualPairSignature ===
          getForeignKeyPairSignature(
            foreignKey.columns,
            foreignKey.referencedColumns,
          ),
    ),
  );
}

function findMatchingForeignKeyForReferencedTable(
  relationship: HasuraMetadataRelationship,
  foreignKeys: readonly ForeignKeyRelation[],
  currentSchema: string,
  currentTable: string,
  relationshipKind: 'object' | 'array',
): ForeignKeyRelation | null {
  const configuration = parseRelationshipUsing(relationship.using);
  if (!configuration) {
    return null;
  }

  let candidates: ForeignKeyRelation[];
  if (configuration.kind === 'foreignKeyConstraintOn') {
    const { constraintOn } = configuration;
    if (
      constraintOn.table?.name !== currentTable ||
      constraintOn.table.schema !== currentSchema
    ) {
      return null;
    }

    candidates = foreignKeys.filter((foreignKey) =>
      areStrArraysEqual(constraintOn.columns, foreignKey.columns),
    );
  } else {
    const manual = configuration.configuration;
    if (
      manual.table.schema !== currentSchema ||
      manual.table.name !== currentTable
    ) {
      return null;
    }

    const manualPairSignature = getForeignKeyPairSignature(
      manual.columnPairs.map(({ toColumn }) => toColumn),
      manual.columnPairs.map(({ fromColumn }) => fromColumn),
    );
    if (!manualPairSignature) {
      return null;
    }

    candidates = foreignKeys.filter(
      (foreignKey) =>
        manualPairSignature ===
        getForeignKeyPairSignature(
          foreignKey.columns,
          foreignKey.referencedColumns,
        ),
    );
  }

  if (candidates.length < 2) {
    return getUniqueForeignKey(candidates);
  }

  // Foreign keys sharing local columns are only distinguishable by the
  // cardinality their relationship was tracked with.
  const expectsOneToOne = relationshipKind === 'object';
  return getUniqueForeignKey(
    candidates.filter(({ oneToOne }) => Boolean(oneToOne) === expectsOneToOne),
  );
}

function addRelationshipNames(
  relationships: readonly { name: string }[],
  tableKey: string,
  relationshipNames: Set<string>,
): void {
  for (const relationship of relationships) {
    if (typeof relationship.name === 'string' && relationship.name.length > 0) {
      relationshipNames.add(`${tableKey}.${relationship.name}`);
    }
  }
}

function collectCurrentTableRelationships({
  metadataTable,
  schema,
  table,
  foreignKeys,
  relationshipMap,
  relationshipNames,
}: {
  metadataTable: HasuraMetadataTable | undefined;
  schema: string;
  table: string;
  foreignKeys: readonly ForeignKeyRelation[];
  relationshipMap: Map<string, ExistingRelationship>;
  relationshipNames: Set<string>;
}): void {
  const relationships = [
    ...(metadataTable?.object_relationships ?? []),
    ...(metadataTable?.array_relationships ?? []),
    ...(metadataTable?.remote_relationships ?? []),
  ];
  addRelationshipNames(relationships, `${schema}.${table}`, relationshipNames);

  for (const relationship of metadataTable?.object_relationships ?? []) {
    const matchingForeignKey = findMatchingForeignKeyForCurrentTable(
      relationship,
      foreignKeys,
      schema,
    );
    if (matchingForeignKey) {
      relationshipMap.set(`${schema}.${table}.${relationship.name}`, {
        foreignKey: matchingForeignKey,
        side: 'local',
      });
    }
  }
}

interface ReferencedForeignKeyGroup {
  foreignKeys: ForeignKeyRelation[];
  schema: string;
  table: string;
}

function groupForeignKeysByReferencedTable(
  foreignKeys: readonly ForeignKeyRelation[],
  fallbackSchema: string,
): Map<string, ReferencedForeignKeyGroup> {
  const groups = new Map<string, ReferencedForeignKeyGroup>();
  for (const foreignKey of foreignKeys) {
    const schema = foreignKey.referencedSchema ?? fallbackSchema;
    const key = JSON.stringify([schema, foreignKey.referencedTable]);
    const group = groups.get(key) ?? {
      schema,
      table: foreignKey.referencedTable,
      foreignKeys: [],
    };
    group.foreignKeys.push(foreignKey);
    groups.set(key, group);
  }
  return groups;
}

function collectReferencedTableRelationships({
  tables,
  foreignKeys,
  currentSchema,
  currentTable,
  relationshipMap,
  relationshipNames,
}: {
  tables: readonly HasuraMetadataTable[];
  foreignKeys: readonly ForeignKeyRelation[];
  currentSchema: string;
  currentTable: string;
  relationshipMap: Map<string, ExistingRelationship>;
  relationshipNames: Set<string>;
}): void {
  const foreignKeyGroups = groupForeignKeysByReferencedTable(
    foreignKeys,
    currentSchema,
  );
  for (const endpointGroup of foreignKeyGroups.values()) {
    const referencedTable = tables.find(
      ({ table }) =>
        table.name === endpointGroup.table &&
        table.schema === endpointGroup.schema,
    );
    if (!referencedTable) {
      continue;
    }

    const objectRelationships = referencedTable.object_relationships ?? [];
    const arrayRelationships = referencedTable.array_relationships ?? [];
    const remoteRelationships = referencedTable.remote_relationships ?? [];
    addRelationshipNames(
      [...objectRelationships, ...arrayRelationships, ...remoteRelationships],
      `${endpointGroup.schema}.${endpointGroup.table}`,
      relationshipNames,
    );

    const relationshipGroups = [
      { relationships: objectRelationships, kind: 'object' as const },
      { relationships: arrayRelationships, kind: 'array' as const },
    ];
    for (const relationshipGroup of relationshipGroups) {
      for (const relationship of relationshipGroup.relationships) {
        const matchingForeignKey = findMatchingForeignKeyForReferencedTable(
          relationship,
          endpointGroup.foreignKeys,
          currentSchema,
          currentTable,
          relationshipGroup.kind,
        );
        if (matchingForeignKey) {
          relationshipMap.set(
            `${endpointGroup.schema}.${endpointGroup.table}.${relationship.name}`,
            { foreignKey: matchingForeignKey, side: 'referenced' },
          );
        }
      }
    }
  }
}

export async function fetchExistingRelationshipState({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  foreignKeys,
}: FetchExistingRelationshipsOptions): Promise<ExistingRelationshipState> {
  const relationshipMap = new Map<string, ExistingRelationship>();
  const relationshipNames = new Set<string>();
  const validForeignKeys = deduplicateValidForeignKeys(foreignKeys, schema);

  const metadataResponse = await fetchExportMetadata({ appUrl, adminSecret });
  const source = metadataResponse.metadata.sources?.find(
    ({ name }) => name === dataSource,
  );
  if (!source?.tables) {
    return { relationshipMap, relationshipNames };
  }

  const tables = source.tables as unknown as HasuraMetadataTable[];
  const currentTable = tables.find(
    (metadataTable) =>
      metadataTable.table.name === table &&
      metadataTable.table.schema === schema,
  );
  collectCurrentTableRelationships({
    metadataTable: currentTable,
    schema,
    table,
    foreignKeys: validForeignKeys,
    relationshipMap,
    relationshipNames,
  });
  collectReferencedTableRelationships({
    tables,
    foreignKeys: validForeignKeys,
    currentSchema: schema,
    currentTable: table,
    relationshipMap,
    relationshipNames,
  });

  return { relationshipMap, relationshipNames };
}
