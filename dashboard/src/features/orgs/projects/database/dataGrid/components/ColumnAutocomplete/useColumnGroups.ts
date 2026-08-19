import type { FetchTableSchemaReturnType } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { AutocompleteOption } from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete/types';
import type { FetchMetadataReturnType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { RelationshipColumnPair } from '@/features/orgs/projects/database/dataGrid/types/relationships';
import {
  alignRelationshipColumnPairs,
  zipRelationshipColumnPairs,
} from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';
import {
  parseForeignKeyConstraintOn,
  parseManualRelationshipConfiguration,
} from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';

export interface UseColumnGroupsOptions {
  /** Selected schema to be used to determine the column groups. */
  selectedSchema?: string;
  /** Selected table to be used to determine the column groups. */
  selectedTable?: string;
  /** Table data to be used to determine the column groups. */
  tableData?: FetchTableSchemaReturnType;
  /** Metadata to be used to determine the column groups. */
  metadata?: FetchMetadataReturnType;
  /** Determines whether or not to disable column groups. */
  disableRelationships?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface RelationshipTarget {
  schema: string;
  table: string;
  columns: string[];
  column?: string;
  columnPairs?: RelationshipColumnPair[];
  name: string;
}

function withScalarColumn(
  target: Omit<RelationshipTarget, 'column'>,
): RelationshipTarget {
  const [column] = target.columns;
  return target.columns.length === 1 && column !== undefined
    ? { ...target, column }
    : target;
}

interface ResolveObjectTargetOptions {
  columns: readonly string[];
  name: string;
  selectedSchema?: string;
  selectedTable?: string;
  tableData?: FetchTableSchemaReturnType;
  metadata?: FetchMetadataReturnType;
}

function resolveLegacyScalarObjectTarget({
  columns,
  name,
  selectedSchema,
  selectedTable,
  metadata,
}: Omit<ResolveObjectTargetOptions, 'tableData'>):
  | RelationshipTarget
  | undefined {
  const [column] = columns;
  if (columns.length !== 1 || !column || !selectedSchema || !selectedTable) {
    return undefined;
  }

  const candidates = new Map<string, RelationshipTarget>();
  for (const metadataTable of metadata?.tables ?? []) {
    if (!metadataTable.table.schema || !metadataTable.table.name) {
      continue;
    }

    const inverseRelationships = [
      ...(metadataTable.object_relationships ?? []),
      ...(metadataTable.array_relationships ?? []),
    ];
    for (const inverseRelationship of inverseRelationships) {
      const using: unknown = inverseRelationship.using;
      if (
        !isRecord(using) ||
        !Object.hasOwn(using, 'foreign_key_constraint_on') ||
        Object.hasOwn(using, 'manual_configuration')
      ) {
        continue;
      }

      const constraint = parseForeignKeyConstraintOn(
        using.foreign_key_constraint_on,
      );
      const [constraintColumn] = constraint?.columns ?? [];
      if (
        !constraint?.table ||
        constraint.columns.length !== 1 ||
        constraintColumn !== column ||
        constraint.table.schema !== selectedSchema ||
        constraint.table.name !== selectedTable
      ) {
        continue;
      }

      const target = withScalarColumn({
        schema: metadataTable.table.schema,
        table: metadataTable.table.name,
        columns: [column],
        name,
      });
      candidates.set(JSON.stringify([target.schema, target.table]), target);
    }
  }

  return candidates.size === 1 ? candidates.values().next().value : undefined;
}

function resolveObjectTarget({
  columns,
  name,
  selectedSchema,
  selectedTable,
  tableData,
  metadata,
}: ResolveObjectTargetOptions): RelationshipTarget | undefined {
  const candidates: RelationshipTarget[] = [];

  for (const relation of tableData?.foreignKeyRelations ?? []) {
    const pairs = zipRelationshipColumnPairs(
      relation.columns,
      relation.referencedColumns,
    );
    const columnPairs = pairs
      ? alignRelationshipColumnPairs(pairs, columns, 'fromColumn')
      : undefined;
    if (!columnPairs) {
      continue;
    }

    const target = withScalarColumn({
      schema: relation.referencedSchema || 'public',
      table: relation.referencedTable,
      columns: [...columns],
      columnPairs,
      name,
    });
    if (target.schema && target.table) {
      candidates.push(target);
    }
  }

  if (candidates.length > 0) {
    return candidates.length === 1 ? candidates[0] : undefined;
  }

  return resolveLegacyScalarObjectTarget({
    columns,
    name,
    selectedSchema,
    selectedTable,
    metadata,
  });
}

export default function useColumnGroups({
  selectedTable,
  selectedSchema,
  tableData,
  metadata,
  disableRelationships,
}: UseColumnGroupsOptions) {
  const columnOptions: AutocompleteOption[] =
    tableData?.columns?.map((column) => ({
      label: column.column_name,
      value: column.column_name,
      group: 'columns',
      metadata: column,
    })) ?? [];

  if (disableRelationships) {
    return columnOptions;
  }

  const metadataTable = metadata?.tables?.find(
    ({ table }) =>
      table.name === selectedTable && table.schema === selectedSchema,
  );
  const relationships = [
    ...(metadataTable?.object_relationships ?? []),
    ...(metadataTable?.array_relationships ?? []),
  ];

  const relationshipOptions = relationships.flatMap<AutocompleteOption>(
    (relationship) => {
      const using: unknown = relationship.using;
      if (!isRecord(using) || typeof relationship.name !== 'string') {
        return [];
      }

      const hasManualConfiguration = Object.hasOwn(
        using,
        'manual_configuration',
      );
      const hasForeignKeyConstraint = Object.hasOwn(
        using,
        'foreign_key_constraint_on',
      );
      if (hasManualConfiguration === hasForeignKeyConstraint) {
        return [];
      }

      if (hasManualConfiguration) {
        const manual = parseManualRelationshipConfiguration(
          using.manual_configuration,
        );
        if (!manual) {
          return [];
        }

        const target = withScalarColumn({
          schema: manual.table.schema,
          table: manual.table.name,
          columns: manual.columnPairs.map(({ fromColumn }) => fromColumn),
          columnPairs: manual.columnPairs,
          name: relationship.name,
        });
        return [
          {
            label: relationship.name,
            value: relationship.name,
            group: 'relationships',
            metadata: { target },
          },
        ];
      }

      const parsedConstraint = parseForeignKeyConstraintOn(
        using.foreign_key_constraint_on,
      );
      if (!parsedConstraint) {
        return [];
      }

      const target = parsedConstraint.table
        ? withScalarColumn({
            schema: parsedConstraint.table.schema,
            table: parsedConstraint.table.name,
            columns: parsedConstraint.columns,
            name: relationship.name,
          })
        : resolveObjectTarget({
            columns: parsedConstraint.columns,
            name: relationship.name,
            selectedSchema,
            selectedTable,
            tableData,
            metadata,
          });
      if (!target?.name) {
        return [];
      }

      return [
        {
          label: relationship.name,
          value: relationship.name,
          group: 'relationships',
          metadata: { target },
        },
      ];
    },
  );

  return [...columnOptions, ...relationshipOptions];
}
