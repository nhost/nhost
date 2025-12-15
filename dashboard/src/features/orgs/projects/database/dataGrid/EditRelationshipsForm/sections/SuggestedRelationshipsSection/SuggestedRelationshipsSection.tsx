import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import AddSuggestedRelationshipDialog from '@/features/orgs/projects/database/dataGrid/EditRelationshipsForm/dialogs/AddSuggestedRelationshipDialog';
import { useGetSuggestedRelationships } from '@/features/orgs/projects/database/dataGrid/hooks/useGetSuggestedRelationships';
import type { RelationshipSuggestionViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships';
import type { SuggestRelationshipsResponseRelationshipsItem } from '@/utils/hasura-api/generated/schemas';
import { ArrowRight, Link2, Split } from 'lucide-react';
import { useState } from 'react';

interface SuggestedRelationshipsSectionProps {
  tableSchema: string;
  tableName: string;
  dataSource: string;
  onRelationshipCreated?: () => Promise<void> | void;
}

export default function SuggestedRelationshipsSection({
  tableSchema,
  tableName,
  dataSource,
  onRelationshipCreated,
}: SuggestedRelationshipsSectionProps) {
  const [
    showAddSuggestedRelationshipDialog,
    setShowAddSuggestedRelationshipDialog,
  ] = useState(false);
  const [selectedSuggestedRelationship, setSelectedSuggestedRelationship] =
    useState<SuggestRelationshipsResponseRelationshipsItem | null>(null);

  const { suggestedRelationships, isLoading, error } =
    useGetSuggestedRelationships({
      dataSource,
      schema: tableSchema,
      tableName,
    });

  if (error instanceof Error) {
    return (
      <section className="px-6">
        <Alert variant="destructive" className="text-left">
          <strong>Error:</strong> {error.message}
        </Alert>
      </section>
    );
  }

  if (isLoading || !suggestedRelationships) {
    return (
      <section className="px-6">
        <Skeleton className="h-10 w-full" />
      </section>
    );
  }

  return (
    <>
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
                suggestedRelationships.map(
                  (suggestion: RelationshipSuggestionViewModel) => (
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
                  ),
                )
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <AddSuggestedRelationshipDialog
        open={showAddSuggestedRelationshipDialog}
        setOpen={(nextOpen) => {
          if (!nextOpen) {
            setSelectedSuggestedRelationship(null);
          }
          setShowAddSuggestedRelationshipDialog(nextOpen);
        }}
        schema={tableSchema}
        tableName={tableName}
        source={dataSource}
        suggestion={selectedSuggestedRelationship}
        onSuccess={onRelationshipCreated}
      />
    </>
  );
}
