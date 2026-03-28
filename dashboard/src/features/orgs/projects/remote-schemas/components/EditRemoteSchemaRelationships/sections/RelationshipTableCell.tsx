import { ArrowRightIcon } from '@/components/ui/v2/icons/ArrowRightIcon';
import {
  isToRemoteSchemaRelationshipDefinition,
  isToSourceRelationshipDefinition,
} from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import getRemoteFieldPath from '@/features/orgs/projects/remote-schemas/utils/getRemoteFieldPath';
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

  const renderRightSide = () => {
    if (isToRemoteSchemaRelationshipDefinition(definition)) {
      const rsName = definition.to_remote_schema.remote_schema;
      const path = getRemoteFieldPath(definition.to_remote_schema.remote_field);

      return (
        <span className="flex items-center gap-1 text-foreground text-sm">
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
        definition.to_source.table?.name ?? definition.to_source?.table ?? '';
      const fieldMappings = Object.entries(
        definition.to_source.field_mapping || {},
      ) as [string, string][];

      return (
        <span className="flex items-center gap-1 text-foreground text-sm">
          <span className="truncate">{tableName}</span>
          {fieldMappings.length > 0 ? <span className="px-1">/</span> : null}
          {fieldMappings.map(([sourceField, col], index) => (
            <span
              key={`to-source-col-${tableName}-${col}-${sourceField}`}
              className="truncate"
            >
              {col}
              {index < fieldMappings.length - 1 ? (
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
      <span className="flex items-center gap-1 text-muted-foreground text-sm">
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
