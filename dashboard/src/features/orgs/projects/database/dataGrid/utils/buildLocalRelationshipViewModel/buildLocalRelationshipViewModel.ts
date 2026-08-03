import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  isUsingForeignKeyConstraint,
  isUsingManualConfiguration,
} from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import type { LocalRelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import type { RelationshipColumnPair } from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';
import {
  alignRelationshipColumnPairsByFromColumns,
  alignRelationshipColumnPairsByToColumns,
  buildRelationshipStructuralKey,
  zipRelationshipColumnPairs,
} from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';
import { formatEndpoint } from '@/features/orgs/projects/database/dataGrid/utils/formatEndpoint';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
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
  const candidates = foreignKeyRelations.flatMap((relation) => {
    const pairs = zipRelationshipColumnPairs(
      relation.columns,
      relation.referencedColumns,
    );
    const alignedPairs = pairs
      ? alignRelationshipColumnPairsByFromColumns(pairs, constrainedColumns)
      : undefined;

    if (!alignedPairs) {
      return [];
    }

    return [
      {
        columnPairs: alignedPairs,
        remoteTableSchema: relation.referencedSchema ?? context.tableSchema,
        remoteTableName: relation.referencedTable,
      },
    ];
  });

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
      ? alignRelationshipColumnPairsByToColumns(pairs, constrainedColumns)
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
  const { name } = relationship;
  const relationshipUsing = relationship.using;

  if (isEmptyValue(name)) {
    throw new Error('Relationship name is required');
  }

  if (!relationshipUsing) {
    throw new Error('Relationship using is required');
  }

  const context = { tableSchema, tableName, dataSource };
  let columnPairs: RelationshipColumnPair[] | undefined;
  let localColumns: string[] = [];
  let remoteColumns: string[] = [];
  let remoteTableSchema = '';
  let remoteTableName = '';

  if (isUsingManualConfiguration(relationshipUsing)) {
    columnPairs = Object.entries(
      relationshipUsing.manual_configuration.column_mapping,
    ).map(([fromColumn, toColumn]) => ({ fromColumn, toColumn }));
    localColumns = columnPairs.map(({ fromColumn }) => fromColumn);
    remoteColumns = columnPairs.map(({ toColumn }) => toColumn);
    remoteTableSchema =
      relationshipUsing.manual_configuration.remote_table.schema;
    remoteTableName = relationshipUsing.manual_configuration.remote_table.name;
  } else if (isUsingForeignKeyConstraint(relationshipUsing)) {
    const { foreign_key_constraint_on: foreignKeyConstraintOn } =
      relationshipUsing;

    if (type === 'Object') {
      let constrainedColumns: string[] = [];
      if (typeof foreignKeyConstraintOn === 'string') {
        constrainedColumns = [foreignKeyConstraintOn];
      } else if (Array.isArray(foreignKeyConstraintOn)) {
        constrainedColumns = [...foreignKeyConstraintOn];
      }
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
    } else {
      if (
        typeof foreignKeyConstraintOn !== 'object' ||
        Array.isArray(foreignKeyConstraintOn)
      ) {
        throw new Error(
          'foreignKeyConstraintOn must be an object when type is Array',
        );
      }

      let constrainedColumns: string[] = [];
      if (
        'column' in foreignKeyConstraintOn &&
        isNotEmptyValue(foreignKeyConstraintOn.column)
      ) {
        constrainedColumns = [foreignKeyConstraintOn.column];
      } else if ('columns' in foreignKeyConstraintOn) {
        constrainedColumns = foreignKeyConstraintOn.columns ?? [];
      }
      remoteColumns = [...constrainedColumns];
      remoteTableSchema = foreignKeyConstraintOn.table?.schema ?? tableSchema;
      remoteTableName = foreignKeyConstraintOn.table?.name ?? '';

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

  const structuralKey = columnPairs
    ? buildRelationshipStructuralKey({
        type,
        source: dataSource,
        from: { schema: tableSchema, table: tableName },
        to: { schema: remoteTableSchema, table: remoteTableName },
        columnPairs,
      })
    : undefined;

  return {
    kind: 'local',
    structuralKey,
    name: relationship.name ?? '',
    fromLabel: formatEndpoint(tableSchema, tableName, localColumns),
    toLabel: formatEndpoint(remoteTableSchema, remoteTableName, remoteColumns),
    type,
    fromSource: dataSource,
  };
}
