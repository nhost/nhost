import type {
  ForeignKeyRelation,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { matchForeignKeysToLocalColumns } from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';
import { parseRelationshipUsing } from '@/features/orgs/projects/database/dataGrid/utils/parseRelationshipUsing';

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
      const configuration = parseRelationshipUsing(inverseRelationship.using);
      if (configuration?.kind !== 'foreignKeyConstraintOn') {
        continue;
      }

      const constraint = configuration.constraintOn;
      const [constraintColumn] = constraint.columns;
      if (
        !constraint.table ||
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
  const candidates = matchForeignKeysToLocalColumns(
    foreignKeyRelations,
    columns,
  ).map(({ relation }) => ({
    schema: relation.referencedSchema || selectedSchema || 'public',
    table: relation.referencedTable,
  }));

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
  const configuration = parseRelationshipUsing(using);
  if (!configuration) {
    return undefined;
  }

  if (configuration.kind === 'manualConfiguration') {
    const { table } = configuration.configuration;
    return { schema: table.schema, table: table.name };
  }

  const constraint = configuration.constraintOn;
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
