import { getForeignKeyConstraintColumns } from '@/features/orgs/projects/database/common/utils/getForeignKeyConstraintColumns';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  isFKConstraintOnSameTable,
  isUsingForeignKeyConstraint,
  isUsingManualConfiguration,
} from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import type { LocalRelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import { formatEndpoint } from '@/features/orgs/projects/database/dataGrid/utils/formatEndpoint';
import {
  areStrArraysEqualOrdered,
  isEmptyValue,
  isNotEmptyValue,
} from '@/lib/utils';
import type {
  ArrayRelationshipItem,
  ObjectRelationshipItem,
  SuggestedArrayRelationship,
  SuggestedObjectRelationship,
} from '@/utils/hasura-api/generated/schemas';

interface BuildLocalRelationshipViewModelProps {
  relationship: ArrayRelationshipItem | ObjectRelationshipItem;
  tableSchema: string;
  tableName: string;
  foreignKeyRelations: ForeignKeyRelation[];
  suggestedRelationships?: (
    | SuggestedArrayRelationship
    | SuggestedObjectRelationship
  )[];
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
      if (isFKConstraintOnSameTable(foreignKeyConstraintOn)) {
        localColumns = getForeignKeyConstraintColumns(foreignKeyConstraintOn);

        const matchingRelation = foreignKeyRelations.find((relation) =>
          areStrArraysEqualOrdered(relation.columns, localColumns),
        );

        if (matchingRelation) {
          remoteTableSchema = matchingRelation.referencedSchema ?? tableSchema;
          remoteTableName = matchingRelation.referencedTable;
          remoteColumns = matchingRelation.referencedColumns;
        }
      }
    } else if (type === 'Array') {
      if (typeof foreignKeyConstraintOn !== 'object') {
        throw new Error(
          'foreignKeyConstraintOn must be an object when type is Array',
        );
      }

      if (!isFKConstraintOnSameTable(foreignKeyConstraintOn)) {
        remoteColumns = getForeignKeyConstraintColumns(foreignKeyConstraintOn);
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

        const isSameToColumns = areStrArraysEqualOrdered(
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
