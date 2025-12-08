import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { RelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import formatEndpoint from '@/features/orgs/projects/database/dataGrid/utils/formatEndpoint';
import normalizeColumns from '@/features/orgs/projects/database/dataGrid/utils/normalizeColumns';
import type {
  ArrayRelationshipItem,
  ObjectRelationshipItem,
} from '@/utils/hasura-api/generated/schemas';

type BuildLocalRelationshipArgs = {
  relationship: ArrayRelationshipItem | ObjectRelationshipItem;
  type: 'Array' | 'Object' | 'RemoteSchema';
  tableSchema: string;
  tableName: string;
  dataSource: string;
  primaryKeyColumns: string[];
  foreignKeyRelations: ForeignKeyRelation[];
};

export default function buildLocalRelationshipViewModel({
  relationship,
  type,
  tableSchema,
  tableName,
  dataSource,
  primaryKeyColumns,
  foreignKeyRelations,
}: BuildLocalRelationshipArgs) {
  const { name, using } = relationship;

  if (!name || !using) {
    return null;
  }

  let localColumns: string[] = [];
  let remoteColumns: string[] = [];
  let remoteSchema: string | undefined;
  let remoteTable: string | undefined;

  if ('manual_configuration' in using && using.manual_configuration) {
    const mappingEntries = Object.entries(
      using.manual_configuration.column_mapping ?? {},
    );
    localColumns = mappingEntries.map(([localColumn]) => localColumn);
    remoteColumns = mappingEntries.map(([, remoteColumn]) =>
      remoteColumn.toString(),
    );
    remoteSchema = using.manual_configuration.remote_table?.schema;
    remoteTable = using.manual_configuration.remote_table?.name;
  } else if ('foreign_key_constraint_on' in using) {
    const foreignKeyConstraint = using.foreign_key_constraint_on;

    if (typeof foreignKeyConstraint === 'string') {
      localColumns = [foreignKeyConstraint];

      if (type === 'Object') {
        const matchingRelation = foreignKeyRelations.find(
          (relation) => relation.columnName === foreignKeyConstraint,
        );

        if (matchingRelation) {
          remoteSchema = matchingRelation.referencedSchema ?? tableSchema;
          remoteTable = matchingRelation.referencedTable;
          remoteColumns = normalizeColumns(matchingRelation.referencedColumn);
        }
      } else {
        remoteColumns = [foreignKeyConstraint];
      }
    } else if (foreignKeyConstraint) {
      const foreignKeyRecord = foreignKeyConstraint as Record<string, unknown>;
      const foreignKeyTable = foreignKeyRecord.table as
        | { schema?: string; name?: string }
        | undefined;

      remoteSchema = foreignKeyTable?.schema;
      remoteTable = foreignKeyTable?.name;

      const normalizedColumns = normalizeColumns(foreignKeyConstraint);

      if (type === 'Object') {
        localColumns = normalizedColumns;
      } else {
        remoteColumns = normalizedColumns;
      }
    }
  } else {
    return null;
  }

  if (type === 'Array' && localColumns.length === 0) {
    localColumns = primaryKeyColumns;
  }

  const structuralKey = JSON.stringify({
    type,
    from: {
      schema: tableSchema,
      table: tableName,
      columns: localColumns,
    },
    to: {
      schema: remoteSchema ?? tableSchema,
      table: remoteTable ?? tableName,
      columns: remoteColumns,
    },
  });

  const keyParts = [
    type,
    name,
    remoteSchema ?? tableSchema,
    remoteTable ?? tableName,
    ...localColumns,
    ...remoteColumns,
  ];

  return {
    key: keyParts.join('-'),
    structuralKey,
    name,
    source: dataSource,
    originSource: dataSource,
    type,
    from: formatEndpoint(tableSchema, tableName, localColumns),
    to: formatEndpoint(remoteSchema, remoteTable, remoteColumns),
  } satisfies RelationshipViewModel;
}
