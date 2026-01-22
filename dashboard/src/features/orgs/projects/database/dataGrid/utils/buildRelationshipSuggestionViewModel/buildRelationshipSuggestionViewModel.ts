import { plural, singular } from 'pluralize';
import type { RelationshipSuggestionViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
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
  const typeLabel =
    suggestion.type && suggestion.type.toLowerCase() === 'array'
      ? 'Array'
      : 'Object';

  const fromElement = suggestion.from;
  const toElement = suggestion.to;

  const localColumns = fromElement?.columns ?? [];
  const remoteColumns = toElement?.columns ?? [];

  const toTableName = toElement?.table?.name ?? tableName;

  const name =
    typeLabel === 'Array' ? plural(toTableName) : singular(toTableName);

  const structuralKey = JSON.stringify({
    type: typeLabel,
    from: {
      schema: fromElement?.table?.schema ?? tableSchema,
      table: fromElement?.table?.name ?? tableName,
      columns: localColumns,
    },
    to: {
      schema: toElement?.table?.schema ?? tableSchema,
      table: toTableName,
      columns: remoteColumns,
    },
  });

  if (existingRelationshipKeys.has(structuralKey)) {
    return null;
  }

  return {
    key: name,
    name,
    source: dataSource,
    type: typeLabel,
    from: formatEndpoint(
      fromElement?.table?.schema ?? tableSchema,
      fromElement?.table?.name ?? tableName,
      localColumns,
    ),
    to: formatEndpoint(
      toElement?.table?.schema ?? tableSchema,
      toTableName,
      remoteColumns,
    ),
    rawSuggestion: suggestion,
  };
}
