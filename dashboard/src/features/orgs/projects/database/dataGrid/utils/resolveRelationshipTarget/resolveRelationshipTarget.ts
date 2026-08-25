import type {
  ForeignKeyRelation,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  alignRelationshipColumnPairs,
  zipRelationshipColumnPairs,
} from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';
import {
  parseForeignKeyConstraintOn,
  parseManualRelationshipConfiguration,
} from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';

export interface RelationshipTableTarget {
  schema: string;
  table: string;
}

interface ResolveRelationshipTargetOptions {
  using: unknown;
  selectedSchema?: string;
  selectedTable?: string;
  foreignKeyRelations?: readonly ForeignKeyRelation[];
  metadataTables?: readonly HasuraMetadataTable[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveLegacyScalarObjectTarget({
  columns,
  selectedSchema,
  selectedTable,
  metadataTables,
}: {
  columns: readonly string[];
  selectedSchema?: string;
  selectedTable?: string;
  metadataTables: readonly HasuraMetadataTable[];
}): RelationshipTableTarget | undefined {
  const [column] = columns;
  if (columns.length !== 1 || !column || !selectedSchema || !selectedTable) {
    return undefined;
  }

  const candidates = new Map<string, RelationshipTableTarget>();
  for (const metadataTable of metadataTables) {
    const { name, schema } = metadataTable.table;
    if (!schema || !name) {
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

      const target = { schema, table: name };
      candidates.set(JSON.stringify([schema, name]), target);
    }
  }

  return candidates.size === 1 ? candidates.values().next().value : undefined;
}

function resolveObjectRelationshipTarget({
  columns,
  selectedSchema,
  selectedTable,
  foreignKeyRelations,
  metadataTables,
}: {
  columns: readonly string[];
  selectedSchema?: string;
  selectedTable?: string;
  foreignKeyRelations: readonly ForeignKeyRelation[];
  metadataTables: readonly HasuraMetadataTable[];
}): RelationshipTableTarget | undefined {
  const candidates = foreignKeyRelations.flatMap((relation) => {
    const columnPairs = zipRelationshipColumnPairs(
      relation.columns,
      relation.referencedColumns,
    );
    if (
      !columnPairs ||
      !alignRelationshipColumnPairs(columnPairs, columns, 'fromColumn')
    ) {
      return [];
    }

    return [
      {
        schema: relation.referencedSchema || selectedSchema || 'public',
        table: relation.referencedTable,
      },
    ];
  });

  if (candidates.length > 0) {
    return candidates.length === 1 ? candidates[0] : undefined;
  }

  return resolveLegacyScalarObjectTarget({
    columns,
    selectedSchema,
    selectedTable,
    metadataTables,
  });
}

export default function resolveRelationshipTarget({
  using,
  selectedSchema,
  selectedTable,
  foreignKeyRelations = [],
  metadataTables = [],
}: ResolveRelationshipTargetOptions): RelationshipTableTarget | undefined {
  if (!isRecord(using)) {
    return undefined;
  }

  const hasManualConfiguration = Object.hasOwn(using, 'manual_configuration');
  const hasForeignKeyConstraint = Object.hasOwn(
    using,
    'foreign_key_constraint_on',
  );
  if (hasManualConfiguration === hasForeignKeyConstraint) {
    return undefined;
  }

  if (hasManualConfiguration) {
    const table = parseManualRelationshipConfiguration(
      using.manual_configuration,
    )?.table;
    return table ? { schema: table.schema, table: table.name } : undefined;
  }

  const constraint = parseForeignKeyConstraintOn(
    using.foreign_key_constraint_on,
  );
  if (!constraint) {
    return undefined;
  }
  if (constraint.table) {
    return {
      schema: constraint.table.schema,
      table: constraint.table.name,
    };
  }

  return resolveObjectRelationshipTarget({
    columns: constraint.columns,
    selectedSchema,
    selectedTable,
    foreignKeyRelations,
    metadataTables,
  });
}
