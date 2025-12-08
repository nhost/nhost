import { useGetRelationships } from '../useGetRelationships';
import { useSuggestRelationshipsQuery } from '../useSuggestRelationshipsQuery';

interface UseGetSuggestedRelationshipsOptions {
  dataSource: string;
}

export default function useGetSuggestedRelationships({
  dataSource,
  schema,
  tableName,
}: UseGetSuggestedRelationshipsOptions) {
  const { relationships } = useGetRelationships({
    dataSource,
    schema,
    tableName,
  });

  const { data: suggestions } = useSuggestRelationshipsQuery(dataSource);

  const tableSuggestions = suggestions?.relationships?.filter(
    (suggestion) =>
      suggestion.from?.table?.name === originalTable.table_name &&
      suggestion.from?.table?.schema === schema,
  );

  const existingRelationshipKeys = new Set(
    relationships.map((relationship) => relationship.structuralKey),
  );

  const suggestedRelationships = (tableSuggestions ?? [])
    .map((suggestion) => {
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
          fromElement?.table?.schema,
          fromElement?.table?.name,
          localColumns,
        ),
        to: formatEndpoint(
          toElement?.table?.schema,
          toElement?.table?.name,
          remoteColumns,
        ),
        rawSuggestion: suggestion,
      };
    })
    .filter(Boolean) as Array<{
    key: string;
    structuralKey: string;
    name: string;
    source: string;
    type: string;
    from: string;
    to: string;
    rawSuggestion: SuggestRelationshipsResponseRelationshipsItem;
  }>;
}
