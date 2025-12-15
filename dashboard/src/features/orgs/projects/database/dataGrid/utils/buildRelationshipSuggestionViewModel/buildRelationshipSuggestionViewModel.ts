import { formatEndpoint } from '@/features/orgs/projects/database/dataGrid/utils/formatEndpoint';
import type { SuggestRelationshipsResponseRelationshipsItem } from '@/utils/hasura-api/generated/schemas';

export interface RelationshipSuggestionViewModel {
  key: string;
  structuralKey: string;
  name: string;
  source: string;
  type: 'Array' | 'Object';
  from: string;
  to: string;
  rawSuggestion: SuggestRelationshipsResponseRelationshipsItem;
}

export const normalizeColumns = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((column) => column.toString());
  }

  if (typeof value === 'object') {
    const foreignKeyObject = value as Record<string, unknown>;

    if ('columns' in foreignKeyObject && foreignKeyObject.columns) {
      return normalizeColumns(foreignKeyObject.columns);
    }

    if ('column' in foreignKeyObject && foreignKeyObject.column) {
      return [String(foreignKeyObject.column)];
    }
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
};

interface BuildRelationshipSuggestionViewModelProps {
  suggestion: SuggestRelationshipsResponseRelationshipsItem;
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

  const localColumns = normalizeColumns(fromElement?.columns);
  const remoteColumns = normalizeColumns(toElement?.columns);

  const name =
    toElement?.constraint_name ??
    fromElement?.constraint_name ??
    toElement?.table?.name ??
    `${typeLabel.toLowerCase()}_relationship`;

  const key = [
    'suggested',
    typeLabel,
    fromElement?.table?.schema,
    fromElement?.table?.name,
    ...localColumns,
    toElement?.table?.schema,
    toElement?.table?.name,
    ...remoteColumns,
  ]
    .filter(Boolean)
    .join('-');

  const structuralKey = JSON.stringify({
    type: typeLabel,
    from: {
      schema: fromElement?.table?.schema ?? tableSchema,
      table: fromElement?.table?.name ?? tableName,
      columns: localColumns,
    },
    to: {
      schema: toElement?.table?.schema ?? tableSchema,
      table: toElement?.table?.name ?? tableName,
      columns: remoteColumns,
    },
  });

  if (existingRelationshipKeys.has(structuralKey)) {
    return null;
  }

  return {
    key: key || name,
    structuralKey,
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
      toElement?.table?.name ?? tableName,
      remoteColumns,
    ),
    rawSuggestion: suggestion,
  };
}
