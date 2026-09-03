import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type {
  LocalRelationshipViewModel,
  RelationshipColumnPair,
} from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import {
  alignRelationshipColumnPairs,
  buildArrayRelationshipRemoteKey,
  buildRelationshipStructuralKey,
  matchForeignKeysToLocalColumns,
  zipRelationshipColumnPairs,
} from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';
import { formatEndpoint } from '@/features/orgs/projects/database/dataGrid/utils/formatEndpoint';
import { parseRelationshipUsing } from '@/features/orgs/projects/database/dataGrid/utils/parseRelationshipUsing';
import type {
  ArrayRelationshipItem,
  ObjectRelationshipItem,
  SuggestedArrayRelationship,
  SuggestedObjectRelationship,
} from '@/utils/hasura-api/generated/schemas';

interface BuildLocalRelationshipViewModelProps {
  relationship: ArrayRelationshipItem | ObjectRelationshipItem;
  tableSchema: string;
  tableName: string;
  foreignKeyRelations: ForeignKeyRelation[];
  suggestedRelationships?: (
    | SuggestedArrayRelationship
    | SuggestedObjectRelationship
  )[];
  type: 'Array' | 'Object';
  dataSource: string;
}

interface ResolvedMapping {
  columnPairs: RelationshipColumnPair[];
  remoteTableSchema: string;
  remoteTableName: string;
}

interface MappingContext {
  tableSchema: string;
  tableName: string;
  dataSource: string;
}

function getDistinctMapping(
  candidates: readonly ResolvedMapping[],
  type: 'Array' | 'Object',
  context: MappingContext,
): ResolvedMapping | undefined {
  const { tableSchema, tableName, dataSource } = context;
  const distinctCandidates = new Map<string, ResolvedMapping>();

  for (const candidate of candidates) {
    const structuralKey = buildRelationshipStructuralKey({
      type,
      source: dataSource,
      from: { schema: tableSchema, table: tableName },
      to: {
        schema: candidate.remoteTableSchema,
        table: candidate.remoteTableName,
      },
      columnPairs: candidate.columnPairs,
    });

    if (structuralKey) {
      distinctCandidates.set(structuralKey, candidate);
    }
  }

  return distinctCandidates.size === 1
    ? distinctCandidates.values().next().value
    : undefined;
}

function resolveObjectForeignKeyMapping({
  constrainedColumns,
  foreignKeyRelations,
  context,
}: {
  constrainedColumns: readonly string[];
  foreignKeyRelations: readonly ForeignKeyRelation[];
  context: MappingContext;
}): ResolvedMapping | undefined {
  const candidates = matchForeignKeysToLocalColumns(
    foreignKeyRelations,
    constrainedColumns,
  ).map(({ relation, columnPairs }) => ({
    columnPairs,
    remoteTableSchema: relation.referencedSchema ?? context.tableSchema,
    remoteTableName: relation.referencedTable,
  }));

  return getDistinctMapping(candidates, 'Object', context);
}

function resolveArrayForeignKeyMapping({
  constrainedColumns,
  remoteTableSchema,
  remoteTableName,
  suggestedRelationships,
  context,
}: {
  constrainedColumns: readonly string[];
  remoteTableSchema: string;
  remoteTableName: string;
  suggestedRelationships: readonly (
    | SuggestedArrayRelationship
    | SuggestedObjectRelationship
  )[];
  context: MappingContext;
}): ResolvedMapping | undefined {
  const candidates = suggestedRelationships.flatMap((suggestion) => {
    if (
      suggestion.type !== 'array' ||
      suggestion.from?.table?.schema !== context.tableSchema ||
      suggestion.from.table.name !== context.tableName ||
      suggestion.to?.table?.schema !== remoteTableSchema ||
      suggestion.to.table.name !== remoteTableName
    ) {
      return [];
    }

    const pairs = zipRelationshipColumnPairs(
      suggestion.from.columns ?? [],
      suggestion.to.columns ?? [],
    );
    const alignedPairs = pairs
      ? alignRelationshipColumnPairs(pairs, constrainedColumns, 'toColumn')
      : undefined;

    if (!alignedPairs) {
      return [];
    }

    return [
      {
        columnPairs: alignedPairs,
        remoteTableSchema,
        remoteTableName,
      },
    ];
  });

  return getDistinctMapping(candidates, 'Array', context);
}

export default function buildLocalRelationshipViewModel({
  relationship,
  tableSchema,
  tableName,
  foreignKeyRelations,
  suggestedRelationships = [],
  type,
  dataSource,
}: BuildLocalRelationshipViewModelProps): LocalRelationshipViewModel {
  const name = typeof relationship.name === 'string' ? relationship.name : '';
  const configuration = parseRelationshipUsing(relationship.using);

  const context = { tableSchema, tableName, dataSource };
  let columnPairs: RelationshipColumnPair[] | undefined;
  let localColumns: string[] = [];
  let remoteColumns: string[] = [];
  let remoteTableSchema = '';
  let remoteTableName = '';
  let canUseArrayFallback = false;

  const manualConfiguration =
    configuration?.kind === 'manualConfiguration'
      ? configuration.configuration
      : undefined;
  if (manualConfiguration) {
    columnPairs = manualConfiguration.columnPairs;
    localColumns = columnPairs.map(({ fromColumn }) => fromColumn);
    remoteColumns = columnPairs.map(({ toColumn }) => toColumn);
    remoteTableSchema = manualConfiguration.table.schema;
    remoteTableName = manualConfiguration.table.name;
  } else if (configuration?.kind === 'foreignKeyConstraintOn') {
    const parsedConstraint = configuration.constraintOn;

    if (type === 'Object') {
      const constrainedColumns = parsedConstraint.table
        ? []
        : [...parsedConstraint.columns];
      localColumns = constrainedColumns;

      const mapping = resolveObjectForeignKeyMapping({
        constrainedColumns,
        foreignKeyRelations,
        context,
      });
      if (mapping) {
        columnPairs = mapping.columnPairs;
        localColumns = columnPairs.map(({ fromColumn }) => fromColumn);
        remoteColumns = columnPairs.map(({ toColumn }) => toColumn);
        remoteTableSchema = mapping.remoteTableSchema;
        remoteTableName = mapping.remoteTableName;
      }
    } else if (parsedConstraint.table) {
      const constrainedColumns = parsedConstraint.columns;
      remoteColumns = [...constrainedColumns];
      remoteTableSchema = parsedConstraint.table.schema;
      remoteTableName = parsedConstraint.table.name;
      canUseArrayFallback = true;

      const mapping = resolveArrayForeignKeyMapping({
        constrainedColumns,
        remoteTableSchema,
        remoteTableName,
        suggestedRelationships,
        context,
      });
      if (mapping) {
        columnPairs = mapping.columnPairs;
        localColumns = columnPairs.map(({ fromColumn }) => fromColumn);
        remoteColumns = columnPairs.map(({ toColumn }) => toColumn);
      }
    }
  }

  let structuralKey = columnPairs
    ? buildRelationshipStructuralKey({
        type,
        source: dataSource,
        from: { schema: tableSchema, table: tableName },
        to: { schema: remoteTableSchema, table: remoteTableName },
        columnPairs,
        allowRepeatedToColumns: manualConfiguration !== undefined,
      })
    : undefined;

  if (!columnPairs && type === 'Array' && canUseArrayFallback) {
    structuralKey = buildArrayRelationshipRemoteKey({
      source: dataSource,
      from: { schema: tableSchema, table: tableName },
      to: { schema: remoteTableSchema, table: remoteTableName },
      remoteColumns,
    });
  }

  return {
    kind: 'local',
    structuralKey,
    columnPairs: structuralKey && columnPairs ? columnPairs : undefined,
    name,
    fromLabel: formatEndpoint(tableSchema, tableName, localColumns),
    toLabel: formatEndpoint(remoteTableSchema, remoteTableName, remoteColumns),
    type,
    fromSource: dataSource,
  };
}
