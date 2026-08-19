import { plural, singular } from 'pluralize';
import type {
  RelationshipColumnPair,
  RelationshipSuggestionViewModel,
} from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import {
  buildArrayRelationshipRemoteKey,
  buildRelationshipStructuralKey,
  zipRelationshipColumnPairs,
} from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';
import { formatEndpoint } from '@/features/orgs/projects/database/dataGrid/utils/formatEndpoint';
import type {
  SuggestedArrayRelationship,
  SuggestedObjectRelationship,
} from '@/utils/hasura-api/generated/schemas';

interface SuggestionIdentityInput {
  suggestion: SuggestedObjectRelationship | SuggestedArrayRelationship;
  dataSource: string;
  localColumns: string[];
  remoteColumns: string[];
}

interface SuggestionIdentity {
  columnPairs: RelationshipColumnPair[];
  structuralKey: string;
  comparisonKeys: string[];
}

function computeSuggestionIdentity({
  suggestion,
  dataSource,
  localColumns,
  remoteColumns,
}: SuggestionIdentityInput): SuggestionIdentity | undefined {
  const fromTable = suggestion.from?.table;
  const toTable = suggestion.to?.table;

  if (
    !fromTable ||
    !toTable ||
    (suggestion.type !== 'array' && suggestion.type !== 'object')
  ) {
    return undefined;
  }

  const from = { schema: fromTable.schema, table: fromTable.name };
  const to = { schema: toTable.schema, table: toTable.name };
  const columnPairs = zipRelationshipColumnPairs(localColumns, remoteColumns);
  if (!columnPairs) {
    return undefined;
  }

  const structuralKey = buildRelationshipStructuralKey({
    type: suggestion.type === 'array' ? 'Array' : 'Object',
    source: dataSource,
    from,
    to,
    columnPairs,
  });
  if (!structuralKey) {
    return undefined;
  }

  if (suggestion.type === 'object') {
    return {
      columnPairs,
      structuralKey,
      comparisonKeys: [structuralKey],
    };
  }

  const fallbackKey = buildArrayRelationshipRemoteKey({
    source: dataSource,
    from,
    to,
    remoteColumns,
  });

  return {
    columnPairs,
    structuralKey,
    comparisonKeys: [structuralKey, fallbackKey].filter(
      (key): key is string => key !== undefined,
    ),
  };
}

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

  const identity = computeSuggestionIdentity({
    suggestion,
    dataSource,
    localColumns,
    remoteColumns,
  });
  if (!identity) {
    return null;
  }

  if (
    identity.comparisonKeys.some((key) => existingRelationshipKeys.has(key))
  ) {
    return null;
  }

  return {
    key: identity.structuralKey,
    name,
    source: dataSource,
    type: typeLabel,
    from: formatEndpoint(fromTableSchema, fromTableName, localColumns),
    to: formatEndpoint(toTableSchema, toTableName, remoteColumns),
    columnPairs: identity.columnPairs,
    rawSuggestion: suggestion,
  };
}
