import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  isUsingForeignKeyConstraint,
  isUsingManualConfiguration,
} from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import type { RelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import { formatEndpoint } from '@/features/orgs/projects/database/dataGrid/utils/formatEndpoint';
import { formatForeignKeyColumns } from '@/features/orgs/projects/database/dataGrid/utils/formatForeignKeyColumns';
import { areStrArraysEqual, isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import type {
  ArrayRelationshipItem,
  ObjectRelationshipItem,
} from '@/utils/hasura-api/generated/schemas';

interface BuildLocalRelationshipViewModelProps {
  relationship: ArrayRelationshipItem | ObjectRelationshipItem;
  tableSchema: string;
  tableName: string;
  foreignKeyRelations: ForeignKeyRelation[];
  type: 'Array' | 'Object';
  dataSource: string;
}

export default function buildLocalRelationshipViewModel({
  relationship,
  tableSchema,
  tableName,
  foreignKeyRelations,
  type,
  dataSource,
}: BuildLocalRelationshipViewModelProps): RelationshipViewModel {
  const { name, using } = relationship;

  if (isEmptyValue(name)) {
    throw new Error('Relationship name is required');
  }

  if (!using) {
    throw new Error('Relationship using is required');
  }

  let localColumns: string[] = [];
  let remoteColumns: string[] = [];
  let remoteTableSchema = '';
  let remoteTableName = '';
  if (isUsingManualConfiguration(using)) {
    localColumns = Object.keys(using.manual_configuration.column_mapping);
    remoteColumns = Object.values(using.manual_configuration.column_mapping);
    remoteTableSchema = using.manual_configuration.remote_table.schema;
    remoteTableName = using.manual_configuration.remote_table.name;
  } else if (isUsingForeignKeyConstraint(using)) {
    const { foreign_key_constraint_on: foreignKeyConstraintOn } = using;
    if (type === 'Object') {
      if (typeof foreignKeyConstraintOn === 'string') {
        localColumns = [foreignKeyConstraintOn];

        const matchingRelation = foreignKeyRelations.find(
          (relation) => relation.columnName === foreignKeyConstraintOn,
        );

        if (matchingRelation) {
          remoteTableSchema = matchingRelation.referencedSchema ?? tableSchema;
          remoteTableName = matchingRelation.referencedTable;
          remoteColumns = formatForeignKeyColumns(
            matchingRelation.referencedColumn,
          );
        }
      } else if (Array.isArray(foreignKeyConstraintOn)) {
        localColumns = foreignKeyConstraintOn;

        const matchingRelation = foreignKeyRelations.find((relation) =>
          areStrArraysEqual(
            formatForeignKeyColumns(relation.columnName),
            foreignKeyConstraintOn,
          ),
        );

        if (matchingRelation) {
          remoteTableSchema = matchingRelation.referencedSchema ?? tableSchema;
          remoteTableName = matchingRelation.referencedTable;
          remoteColumns = formatForeignKeyColumns(
            matchingRelation.referencedColumn,
          );
        }
      }
    } else if (type === 'Array') {
      if (typeof foreignKeyConstraintOn !== 'object') {
        throw new Error(
          'foreignKeyConstraintOn must be an object when type is Array',
        );
      }

      if ('column' in foreignKeyConstraintOn) {
        remoteColumns = isNotEmptyValue(foreignKeyConstraintOn.column)
          ? [foreignKeyConstraintOn.column]
          : [];
      } else if ('columns' in foreignKeyConstraintOn) {
        remoteColumns = foreignKeyConstraintOn.columns ?? [];
        remoteTableSchema = foreignKeyConstraintOn.table?.schema ?? tableSchema;
        remoteTableName = foreignKeyConstraintOn.table?.name ?? '';
      }

      const matchingRelation = foreignKeyRelations.find(
        (relation) =>
          relation.referencedSchema === remoteTableSchema &&
          relation.referencedTable === remoteTableName,
      );
      if (matchingRelation) {
        remoteColumns = formatForeignKeyColumns(
          matchingRelation.referencedColumn,
        );
      }
    }
  }
  const structuralKey = JSON.stringify({
    type,
    from: {
      schema: tableSchema,
      table: tableName,
      columns: localColumns,
    },
    to: {
      schema: remoteTableSchema ?? tableSchema,
      table: remoteTableName ?? tableName,
      columns: remoteColumns,
    },
  });

  return {
    key: relationship.name ?? '',
    structuralKey,
    name: relationship.name ?? '',
    from: formatEndpoint(tableSchema, tableName, localColumns),
    to: formatEndpoint(remoteTableSchema, remoteTableName, remoteColumns),
    type,
    source: dataSource,
    originSource: dataSource,
  };
}
