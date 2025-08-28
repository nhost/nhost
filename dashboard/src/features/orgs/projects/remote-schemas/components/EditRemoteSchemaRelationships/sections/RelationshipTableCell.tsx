import { ArrowRightIcon } from '@/components/ui/v2/icons/ArrowRightIcon';
import {
  isToRemoteSchemaRelationshipDefinition,
  isToSourceRelationshipDefinition,
} from '@/features/orgs/projects/remote-schemas/utils/guards';
import type { RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem } from '@/utils/hasura-api/generated/schemas';

interface RelationshipTableCellProps {
  relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem;
}

export default function RelationshipTableCell({
  relationship,
}: RelationshipTableCellProps) {
  const { definition } = relationship;

  const getLhsLeafs = (): string[] => {
    if (isToSourceRelationshipDefinition(definition)) {
      return Object.keys(definition.to_source.field_mapping || {});
    }
    if (isToRemoteSchemaRelationshipDefinition(definition)) {
      return definition.to_remote_schema.lhs_fields || [];
    }
    return [];
  };

  const getRemoteFieldPath = (
    remoteField: Record<string, unknown> | undefined,
  ): string[] => {
    if (!remoteField) {
      return [];
    }
    const keys = Object.keys(remoteField);
    if (keys.length === 0) {
      return [];
    }
    const head = keys[0];
    const value = remoteField[head] as
      | { field?: Record<string, unknown> }
      | undefined;
    return [head, ...(value?.field ? getRemoteFieldPath(value.field) : [])];
  };

  const renderRightSide = () => {
    if (isToRemoteSchemaRelationshipDefinition(definition)) {
      const rsName = definition.to_remote_schema.remote_schema;
      const path = getRemoteFieldPath(definition.to_remote_schema.remote_field);

      return (
        <span className="flex items-center gap-1 text-sm text-foreground">
          <span className="truncate">{rsName}</span>
          <span className="px-1">/</span>
          {path.map((segment, index) => {
            const cumulativeKey = path.slice(0, index + 1).join('/');
            return (
              <span key={`rs-path-${cumulativeKey}`} className="truncate">
                {segment}
                {index < path.length - 1 ? (
                  <span className="px-1">/</span>
                ) : null}
              </span>
            );
          })}
        </span>
      );
    }

    if (isToSourceRelationshipDefinition(definition)) {
      const tableName =
        definition.to_source.table?.name ??
        // Support string table in case API returns simple form
        (definition.to_source as unknown as { table?: string })?.table ??
        '';
      const columns = Object.values(
        definition.to_source.field_mapping || {},
      ) as string[];

      return (
        <span className="flex items-center gap-1 text-sm text-foreground">
          <span className="truncate">{tableName}</span>
          {columns.length > 0 ? <span className="px-1">/</span> : null}
          {columns.map((col, index) => (
            <span
              key={`to-source-col-${tableName}-${col}`}
              className="truncate"
            >
              {col}
              {index < columns.length - 1 ? (
                <span className="px-1">,</span>
              ) : null}
            </span>
          ))}
        </span>
      );
    }

    return null;
  };

  const lhsLeafs = getLhsLeafs();

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        {lhsLeafs.map((leaf, index) => (
          <span key={`lhs-${relationship.name}-${leaf}`} className="truncate">
            {leaf}
            {index < lhsLeafs.length - 1 ? (
              <span className="px-1">,</span>
            ) : null}
          </span>
        ))}
      </span>
      <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
      {renderRightSide()}
    </div>
  );
}
