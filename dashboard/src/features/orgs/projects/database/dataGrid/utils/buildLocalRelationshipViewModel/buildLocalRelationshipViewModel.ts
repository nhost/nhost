import type { RelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import { areStrArraysEqual, isEmptyValue } from '@/lib/utils';
import type {
  ArrayRelationshipItem,
  ObjectRelationshipItem,
} from '@/utils/hasura-api/generated/schemas';
import { ForeignKeyRelation } from '../../types/dataBrowser';
import {
  isUsingForeignKeyConstraint,
  isUsingManualConfiguration,
} from '../../types/relationships/guards';

interface BuildLocalRelationshipViewModelProps {
  relationship: ArrayRelationshipItem | ObjectRelationshipItem;
  tableSchema: string;
  tableName: string;
  foreignKeyRelations: ForeignKeyRelation[];
  type: 'Array' | 'Object';
}

const formatEndpoint = (
  schema: string,
  table: string,
  columnsNames: string[],
) => {
  const tableName = `${schema}.${table}`;
  const formattedColumns =
    columnsNames.length > 0 ? columnsNames.join(', ') : 'Not specified';
  return `${tableName} / ${formattedColumns}`;
};

const formatForeignKeyColumns = (referencedColumn: string) => {
  const columns = referencedColumn.split(',');
  return columns.map((column) => column.trim());
};

export default function buildLocalRelationshipViewModel({
  relationship,
  tableSchema,
  tableName,
  foreignKeyRelations,
  type,
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
        remoteColumns = [foreignKeyConstraintOn.column ?? ''];
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
    console.log(using);
  }

  return {
    key: Math.random().toString(),
    structuralKey: Math.random().toString(),
    name: relationship.name ?? '',
    from: formatEndpoint(tableSchema, tableName, localColumns),
    to: formatEndpoint(remoteTableSchema, remoteTableName, remoteColumns),
    type: 'Array',
    source: '',
    originSource: '',
  };
}
