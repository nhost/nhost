import { plural, singular } from 'pluralize';
import type { RelationshipSuggestionViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import {
  buildRelationshipStructuralKey,
  zipRelationshipColumnPairs,
} from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';
import { formatEndpoint } from '@/features/orgs/projects/database/dataGrid/utils/formatEndpoint';
import type {
  SuggestedArrayRelationship,
  SuggestedObjectRelationship,
} from '@/utils/hasura-api/generated/schemas';

interface BuildRelationshipSuggestionViewModelProps {
  suggestion: SuggestedObjectRelationship | SuggestedArrayRelationship;
  tableSchema: string;
  tableName: string;
  dataSource: string;
  existingRelationshipKeys: Set<string>;
}

export default function buildRelationshipSuggestionViewModel({
  suggestion,
  tableSchema,
  tableName,
  dataSource,
  existingRelationshipKeys,
}: BuildRelationshipSuggestionViewModelProps): RelationshipSuggestionViewModel | null {
  const typeLabel = suggestion.type === 'array' ? 'Array' : 'Object';
  const fromElement = suggestion.from;
  const toElement = suggestion.to;
  const localColumns = fromElement?.columns ?? [];
  const remoteColumns = toElement?.columns ?? [];
  const fromTableSchema = fromElement?.table?.schema ?? tableSchema;
  const fromTableName = fromElement?.table?.name ?? tableName;
  const toTableSchema = toElement?.table?.schema ?? tableSchema;
  const toTableName = toElement?.table?.name ?? tableName;
  const name =
    typeLabel === 'Array' ? plural(toTableName) : singular(toTableName);

  const columnPairs = zipRelationshipColumnPairs(localColumns, remoteColumns);
  const fromTable = fromElement?.table;
  const toTable = toElement?.table;
  const structuralKey =
    columnPairs &&
    (suggestion.type === 'array' || suggestion.type === 'object') &&
    fromTable &&
    toTable
      ? buildRelationshipStructuralKey({
          type: typeLabel,
          source: dataSource,
          from: {
            schema: fromTable.schema,
            table: fromTable.name,
          },
          to: {
            schema: toTable.schema,
            table: toTable.name,
          },
          columnPairs,
        })
      : undefined;

  if (structuralKey && existingRelationshipKeys.has(structuralKey)) {
    return null;
  }

  return {
    key: name,
    name,
    source: dataSource,
    type: typeLabel,
    from: formatEndpoint(fromTableSchema, fromTableName, localColumns),
    to: formatEndpoint(toTableSchema, toTableName, remoteColumns),
    rawSuggestion: suggestion,
  };
}
