import type {
  MetadataRemoteRelationship,
  RelationshipViewModel,
} from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import formatEndpoint from '@/features/orgs/projects/database/dataGrid/utils/formatEndpoint';
import formatRemoteSchemaEndpoint from '@/features/orgs/projects/database/dataGrid/utils/formatRemoteSchemaEndpoint';
import formatRemoteSourceEndpoint from '@/features/orgs/projects/database/dataGrid/utils/formatRemoteSourceEndpoint';
import getRemoteFieldPath from '@/features/orgs/projects/database/dataGrid/utils/getRemoteFieldPath';
import { isToRemoteSchemaRelationshipDefinition } from '@/features/orgs/projects/remote-schemas/utils/guards';

type BuildRemoteRelationshipArgs = {
  relationship: MetadataRemoteRelationship;
  tableSchema: string;
  tableName: string;
  dataSource: string;
};

export default function buildRemoteRelationshipViewModel({
  relationship,
  tableSchema,
  tableName,
  dataSource,
}: BuildRemoteRelationshipArgs): RelationshipViewModel | null {
  const { name, definition } = relationship;

  if (!name || !definition) {
    return null;
  }

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

    const structuralKey = JSON.stringify({
      type: 'RemoteSchema',
      from: {
        schema: tableSchema,
        table: tableName,
        columns: localColumns,
      },
      to: {
        remoteSchema: remoteSchemaName,
        path: remoteFieldPath,
      },
    });

    const keyParts = [
      'RemoteSchema',
      name,
      remoteSchemaName,
      ...localColumns,
      ...remoteFieldPath,
    ].filter(Boolean);

    return {
      key: keyParts.join('-'),
      structuralKey,
      name,
      source: remoteSchemaName,
      originSource: dataSource,
      type: 'RemoteSchema',
      isRemote: true,
      rawRemoteRelationship: relationship,
      from: formatEndpoint(tableSchema, tableName, localColumns),
      to: formatRemoteSchemaEndpoint(remoteSchemaName, remoteFieldPath),
    };
  }

  if (
    'to_source' in definition &&
    definition.to_source /* type guard for TS */
  ) {
    const fieldMappingEntries = Object.entries(
      definition.to_source.field_mapping ?? {},
    );
    const localColumns = fieldMappingEntries.map(([sourceColumn]) =>
      sourceColumn.toString(),
    );
    const remoteColumns = fieldMappingEntries.map(([, targetColumn]) =>
      targetColumn.toString(),
    );
    const targetSource = definition.to_source.source;
    const targetSchema = definition.to_source.table?.schema;
    const targetTable = definition.to_source.table?.name;
    const relationshipType =
      definition.to_source.relationship_type?.toLowerCase() === 'array'
        ? 'Array'
        : 'Object';

    const structuralKey = JSON.stringify({
      type: `RemoteSource:${relationshipType}`,
      from: {
        schema: tableSchema,
        table: tableName,
        columns: localColumns,
      },
      to: {
        source: targetSource,
        schema: targetSchema,
        table: targetTable,
        columns: remoteColumns,
      },
    });

    const keyParts = [
      relationshipType,
      name,
      targetSource,
      targetSchema,
      targetTable,
      ...localColumns,
      ...remoteColumns,
    ].filter(Boolean);

    return {
      key: keyParts.join('-'),
      structuralKey,
      name,
      source: targetSource ?? dataSource,
      originSource: dataSource,
      type: relationshipType,
      isRemote: true,
      rawRemoteRelationship: relationship,
      from: formatEndpoint(tableSchema, tableName, localColumns),
      to: formatRemoteSourceEndpoint(
        targetSource,
        targetSchema,
        targetTable,
        remoteColumns,
      ),
    };
  }

  return null;
}
