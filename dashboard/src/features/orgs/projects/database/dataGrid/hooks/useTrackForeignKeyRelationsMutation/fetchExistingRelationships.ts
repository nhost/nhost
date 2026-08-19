import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import type {
  ForeignKeyRelation,
  HasuraMetadataRelationship,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  parseForeignKeyConstraintOn,
  parseManualRelationshipConfiguration,
} from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';
import { getForeignKeyPairSignature } from '@/features/orgs/projects/database/dataGrid/utils/getForeignKeyPairSignature';
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

interface RelationshipConfiguration {
  foreignKeyConstraintOn?: ReturnType<typeof parseForeignKeyConstraintOn>;
  manualConfiguration?: ReturnType<typeof parseManualRelationshipConfiguration>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRelationshipConfiguration(
  relationship: HasuraMetadataRelationship,
): RelationshipConfiguration | undefined {
  const using: unknown = relationship.using;
  if (!isRecord(using)) {
    return undefined;
  }

  const hasForeignKeyConstraint = Object.hasOwn(
    using,
    'foreign_key_constraint_on',
  );
  const hasManualConfiguration = Object.hasOwn(using, 'manual_configuration');
  if (hasForeignKeyConstraint === hasManualConfiguration) {
    return undefined;
  }

  if (hasForeignKeyConstraint) {
    const foreignKeyConstraintOn = parseForeignKeyConstraintOn(
      using.foreign_key_constraint_on,
    );
    return foreignKeyConstraintOn ? { foreignKeyConstraintOn } : undefined;
  }

  const manualConfiguration = parseManualRelationshipConfiguration(
    using.manual_configuration,
  );
  return manualConfiguration ? { manualConfiguration } : undefined;
}

function isValidForeignKeyRelation(relation: ForeignKeyRelation): boolean {
  return (
    relation.referencedTable.length > 0 &&
    getForeignKeyPairSignature(relation.columns, relation.referencedColumns) !==
      null
  );
}

function deduplicateValidForeignKeys(
  foreignKeys: readonly ForeignKeyRelation[],
  dataSource: string,
  sourceSchema: string,
  sourceTable: string,
): ForeignKeyRelation[] {
  const uniqueForeignKeys = new Map<string, ForeignKeyRelation>();

  for (const foreignKey of foreignKeys) {
    if (!isValidForeignKeyRelation(foreignKey)) {
      continue;
    }

    const pairSignature = getForeignKeyPairSignature(
      foreignKey.columns,
      foreignKey.referencedColumns,
    );
    if (!pairSignature) {
      continue;
    }

    const identity = JSON.stringify([
      dataSource,
      [sourceSchema, sourceTable],
      [foreignKey.referencedSchema || sourceSchema, foreignKey.referencedTable],
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
  const configuration = parseRelationshipConfiguration(relationship);
  if (!configuration) {
    return null;
  }

  const candidates = foreignKeys.filter((foreignKey) => {
    const constraint = configuration.foreignKeyConstraintOn;
    if (constraint) {
      return (
        !constraint.table &&
        areStrArraysEqual(foreignKey.columns, constraint.columns)
      );
    }

    const manual = configuration.manualConfiguration;
    if (!manual) {
      return false;
    }

    const referencedSchema = foreignKey.referencedSchema ?? currentSchema;
    const manualPairSignature = getForeignKeyPairSignature(
      manual.columnPairs.map(({ fromColumn }) => fromColumn),
      manual.columnPairs.map(({ toColumn }) => toColumn),
    );

    return (
      manual.table.schema === referencedSchema &&
      manual.table.name === foreignKey.referencedTable &&
      manualPairSignature !== null &&
      manualPairSignature ===
        getForeignKeyPairSignature(
          foreignKey.columns,
          foreignKey.referencedColumns,
        )
    );
  });

  return getUniqueForeignKey(candidates);
}

function findMatchingForeignKeyForReferencedTable(
  relationship: HasuraMetadataRelationship,
  foreignKeys: readonly ForeignKeyRelation[],
  currentSchema: string,
  currentTable: string,
): ForeignKeyRelation | null {
  const configuration = parseRelationshipConfiguration(relationship);
  if (!configuration) {
    return null;
  }

  const candidates = foreignKeys.filter((foreignKey) => {
    const constraint = configuration.foreignKeyConstraintOn;
    if (constraint) {
      return (
        constraint.table?.name === currentTable &&
        constraint.table.schema === currentSchema &&
        areStrArraysEqual(constraint.columns, foreignKey.columns)
      );
    }

    const manual = configuration.manualConfiguration;
    if (
      !manual ||
      manual.table.schema !== currentSchema ||
      manual.table.name !== currentTable
    ) {
      return false;
    }

    const manualPairSignature = getForeignKeyPairSignature(
      manual.columnPairs.map(({ toColumn }) => toColumn),
      manual.columnPairs.map(({ fromColumn }) => fromColumn),
    );

    return (
      manualPairSignature !== null &&
      manualPairSignature ===
        getForeignKeyPairSignature(
          foreignKey.columns,
          foreignKey.referencedColumns,
        )
    );
  });

  return getUniqueForeignKey(candidates);
}

function addRelationshipNames(
  relationships: readonly HasuraMetadataRelationship[],
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
  relationshipMap: Map<string, ForeignKeyRelation>;
  relationshipNames: Set<string>;
}): void {
  const relationships = [
    ...(metadataTable?.object_relationships ?? []),
    ...(metadataTable?.array_relationships ?? []),
  ];
  addRelationshipNames(relationships, `${schema}.${table}`, relationshipNames);

  for (const relationship of metadataTable?.object_relationships ?? []) {
    const matchingForeignKey = findMatchingForeignKeyForCurrentTable(
      relationship,
      foreignKeys,
      schema,
    );
    if (matchingForeignKey) {
      relationshipMap.set(
        `${schema}.${table}.${relationship.name}`,
        matchingForeignKey,
      );
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
  relationshipMap: Map<string, ForeignKeyRelation>;
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
    addRelationshipNames(
      [...objectRelationships, ...arrayRelationships],
      `${endpointGroup.schema}.${endpointGroup.table}`,
      relationshipNames,
    );

    const relationshipGroups = [
      {
        relationships: objectRelationships,
        foreignKeys: endpointGroup.foreignKeys.filter(
          ({ oneToOne }) => oneToOne,
        ),
      },
      {
        relationships: arrayRelationships,
        foreignKeys: endpointGroup.foreignKeys.filter(
          ({ oneToOne }) => !oneToOne,
        ),
      },
    ];
    for (const relationshipGroup of relationshipGroups) {
      for (const relationship of relationshipGroup.relationships) {
        const matchingForeignKey = findMatchingForeignKeyForReferencedTable(
          relationship,
          relationshipGroup.foreignKeys,
          currentSchema,
          currentTable,
        );
        if (matchingForeignKey) {
          relationshipMap.set(
            `${endpointGroup.schema}.${endpointGroup.table}.${relationship.name}`,
            matchingForeignKey,
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
  const relationshipMap = new Map<string, ForeignKeyRelation>();
  const relationshipNames = new Set<string>();
  const validForeignKeys = deduplicateValidForeignKeys(
    foreignKeys,
    dataSource,
    schema,
    table,
  );

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

export default async function fetchExistingRelationships(
  options: FetchExistingRelationshipsOptions,
): Promise<Map<string, ForeignKeyRelation>> {
  const state = await fetchExistingRelationshipState(options);
  return state.relationshipMap;
}
