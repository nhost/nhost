import { Alert } from '@/components/ui/v3/alert';
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { AddSuggestedRelationshipDialog } from '@/features/orgs/projects/database/dataGrid/components/AddSuggestedRelationshipDialog';
import { useGetSuggestedRelationships } from '@/features/orgs/projects/database/dataGrid/hooks/useGetSuggestedRelationships';
import { ArrowRight, Link2, Split } from 'lucide-react';

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
                    <AddSuggestedRelationshipDialog
                      schema={tableSchema}
                      tableName={tableName}
                      source={dataSource}
                      suggestion={suggestion.rawSuggestion}
                      onSuccess={onRelationshipCreated}
                    />
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
