import { Button } from '@/components/ui/v3/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { useGetRelationships } from '@/features/orgs/projects/database/dataGrid/hooks/useGetRelationships';
import { useSuggestRelationshipsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery';
import {
  buildRelationshipSuggestionViewModel,
  type RelationshipSuggestionViewModel,
} from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipSuggestionViewModel';
import type { SuggestRelationshipsResponseRelationshipsItem } from '@/utils/hasura-api/generated/schemas';
import { ArrowRight, Link2, Split } from 'lucide-react';
import { useState } from 'react';

interface SuggestedRelationshipsSectionProps {
  tableSchema: string;
  tableName: string;
  dataSource: string;
}

export default function SuggestedRelationshipsSection({
  tableSchema,
  tableName,
  dataSource,
}: SuggestedRelationshipsSectionProps) {
  const { data: suggestions } = useSuggestRelationshipsQuery(dataSource, {
    schema: tableSchema,
    name: tableName,
  });

  const { relationships } = useGetRelationships({
    dataSource,
    schema: tableSchema,
    tableName,
  });

  const tableSuggestions = suggestions?.relationships?.filter(
    (suggestion) =>
      suggestion.from?.table?.name === tableName &&
      suggestion.from?.table?.schema === tableSchema,
  );

  const [, setSelectedSuggestedRelationship] =
    useState<SuggestRelationshipsResponseRelationshipsItem | null>(null);
  const [, setShowAddSuggestedRelationshipDialog] = useState(false);

  const existingRelationshipKeys = new Set(
    relationships.map((relationship) => relationship.structuralKey),
  );

  const suggestedRelationships = (tableSuggestions ?? [])
    .map((suggestion) =>
      buildRelationshipSuggestionViewModel({
        suggestion,
        tableSchema,
        tableName,
        dataSource,
        existingRelationshipKeys,
      }),
    )
    .filter(Boolean) as RelationshipSuggestionViewModel[];

  return (
    <section className="px-6">
      <h2 className="text-sm+ font-semibold text-foreground">
        Suggested Relationships
      </h2>

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Name</TableHead>
              <TableHead className="w-[120px]">Source</TableHead>
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead>Relationship</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suggestedRelationships.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No suggested relationships available.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              suggestedRelationships.map((suggestion) => (
                <TableRow key={suggestion.key}>
                  <TableCell className="font-medium">
                    {suggestion.name}
                  </TableCell>
                  <TableCell>{suggestion.source}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {suggestion.type === 'Array' ? (
                        <Split className="h-4 w-4 rotate-90 text-muted-foreground" />
                      ) : (
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{suggestion.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{suggestion.from}</span>
                      <ArrowRight className="h-4 w-4" />
                      <span>{suggestion.to}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedSuggestedRelationship(
                          suggestion.rawSuggestion,
                        );
                        setShowAddSuggestedRelationshipDialog(true);
                      }}
                    >
                      Add
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
