import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  isUsingForeignKeyConstraint,
  isUsingManualConfiguration,
} from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import type { LocalRelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import { formatEndpoint } from '@/features/orgs/projects/database/dataGrid/utils/formatEndpoint';
import { formatForeignKeyColumns } from '@/features/orgs/projects/database/dataGrid/utils/formatForeignKeyColumns';
import { areStrArraysEqual, isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import type {
  ArrayRelationshipItem,
  ObjectRelationshipItem,
  SuggestRelationshipsResponseRelationshipsItem,
} from '@/utils/hasura-api/generated/schemas';

interface BuildLocalRelationshipViewModelProps {
  relationship: ArrayRelationshipItem | ObjectRelationshipItem;
  tableSchema: string;
  tableName: string;
  foreignKeyRelations: ForeignKeyRelation[];
  suggestedRelationships?: SuggestRelationshipsResponseRelationshipsItem[];
  type: 'Array' | 'Object';
  dataSource: string;
}

export default function buildLocalRelationshipViewModel({
  relationship,
  tableSchema,
  tableName,
  foreignKeyRelations,
  suggestedRelationships,
  type,
  dataSource,
}: BuildLocalRelationshipViewModelProps): LocalRelationshipViewModel {
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
        remoteTableSchema = foreignKeyConstraintOn.table?.schema ?? tableSchema;
        remoteTableName = foreignKeyConstraintOn.table?.name ?? '';
      } else if ('columns' in foreignKeyConstraintOn) {
        remoteColumns = foreignKeyConstraintOn.columns ?? [];
        remoteTableSchema = foreignKeyConstraintOn.table?.schema ?? tableSchema;
        remoteTableName = foreignKeyConstraintOn.table?.name ?? '';
      }

      const matchingSuggestion = suggestedRelationships?.find((suggestion) => {
        const suggestionFrom = suggestion.from;
        const suggestionTo = suggestion.to;

        if (suggestion.type !== 'array') {
          return false;
        }

        const isSameFromTable =
          suggestionFrom?.table?.schema === tableSchema &&
          suggestionFrom?.table?.name === tableName;

        const isSameToTable =
          suggestionTo?.table?.schema === remoteTableSchema &&
          suggestionTo?.table?.name === remoteTableName;

        const isSameToColumns = areStrArraysEqual(
          suggestionTo?.columns ?? [],
          remoteColumns,
        );

        return isSameFromTable && isSameToTable && isSameToColumns;
      });

      if (isNotEmptyValue(matchingSuggestion)) {
        localColumns = matchingSuggestion.from?.columns ?? [];
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
    kind: 'local',
    structuralKey,
    name: relationship.name ?? '',
    fromLabel: formatEndpoint(tableSchema, tableName, localColumns),
    toLabel: formatEndpoint(remoteTableSchema, remoteTableName, remoteColumns),
    type,
    fromSource: dataSource,
  };
}
