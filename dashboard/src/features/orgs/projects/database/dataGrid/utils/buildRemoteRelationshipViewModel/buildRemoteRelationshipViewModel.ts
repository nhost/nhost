import { isToRemoteSchemaRelationshipDefinition } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import type { RemoteRelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import { formatEndpoint } from '@/features/orgs/projects/database/dataGrid/utils/formatEndpoint';
import formatRemoteSchemaEndpoint from '@/features/orgs/projects/database/dataGrid/utils/formatRemoteSchemaEndpoint';
import getRemoteFieldPath from '@/features/orgs/projects/database/dataGrid/utils/getRemoteFieldPath';
import type { RemoteRelationshipItem } from '@/utils/hasura-api/generated/schemas';

type BuildRemoteRelationshipArgs = {
  relationship: RemoteRelationshipItem;
  tableSchema: string;
  tableName: string;
  dataSource: string;
};

export default function buildRemoteRelationshipViewModel({
  relationship,
  tableSchema,
  tableName,
  dataSource,
}: BuildRemoteRelationshipArgs): RemoteRelationshipViewModel {
  const { name, definition } = relationship;

  if (isToRemoteSchemaRelationshipDefinition(definition)) {
    const localColumns =
      definition.to_remote_schema.lhs_fields?.map((field) =>
        field.toString(),
      ) ?? [];
    const remoteFieldPath = getRemoteFieldPath(
      definition.to_remote_schema.remote_field,
    );
    const remoteSchemaName =
      definition.to_remote_schema.remote_schema ?? 'Remote schema';

    return {
      kind: 'remote',
      key: relationship.name ?? '',
      name,
      fromLabel: formatEndpoint(tableSchema, tableName, localColumns),
      toLabel: formatRemoteSchemaEndpoint(remoteSchemaName, remoteFieldPath),
      fromSource: dataSource,
      toSource: remoteSchemaName,
      type: 'RemoteSchema',
      definition,
    };
  }

  const {
    source: toSource,
    table: remoteTable,
    relationship_type,
    field_mapping,
  } = definition.to_source;

  const [localColumns, remoteColumns] = Object.entries(field_mapping);

  return {
    kind: 'remote',
    key: relationship.name ?? '',
    name: relationship.name ?? '',
    fromLabel: formatEndpoint(tableSchema, tableName, localColumns),
    toLabel: formatEndpoint(
      remoteTable.schema,
      remoteTable.name,
      remoteColumns,
    ),
    fromSource: dataSource,
    toSource,
    type: relationship_type === 'array' ? 'Array' : 'Object',
    definition: relationship.definition,
  };
}
