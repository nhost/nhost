import useGetRelationships from '@/features/orgs/projects/database/dataGrid/hooks/useGetRelationships/useGetRelationships';
import { useSuggestRelationshipsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery';
import { isLocalRelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import buildRelationshipSuggestionViewModel from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipSuggestionViewModel/buildRelationshipSuggestionViewModel';
import { isNotEmptyValue } from '@/lib/utils';

interface UseGetSuggestedRelationshipsOptions {
  dataSource: string;
  schema: string;
  tableName: string;
}

export default function useGetSuggestedRelationships({
  dataSource,
  schema,
  tableName,
}: UseGetSuggestedRelationshipsOptions) {
  const {
    data: suggestions,
    isLoading: isSuggestionsLoading,
    error: suggestionsError,
  } = useSuggestRelationshipsQuery(dataSource, {
    schema,
    name: tableName,
  });

  const {
    relationships,
    isLoading: isRelationshipsLoading,
    error: relationshipsError,
  } = useGetRelationships({
    dataSource,
    schema,
    tableName,
  });

  const tableSuggestions = suggestions?.relationships?.filter(
    (suggestion) =>
      suggestion.from?.table?.name === tableName &&
      suggestion.from?.table?.schema === schema,
  );

  const existingRelationshipKeys = new Set(
    relationships
      .filter(isLocalRelationshipViewModel)
      .map((relationship) => relationship.structuralKey),
  );

  const suggestedRelationships = tableSuggestions
    ?.map((suggestion) =>
      buildRelationshipSuggestionViewModel({
        suggestion,
        tableSchema: schema,
        tableName,
        dataSource,
        existingRelationshipKeys,
      }),
    )
    .filter(isNotEmptyValue);

  return {
    suggestedRelationships,
    isLoading: isSuggestionsLoading || isRelationshipsLoading,
    error: suggestionsError ?? relationshipsError ?? null,
  };
}
