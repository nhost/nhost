import { ArrowDown, Link2, Split } from 'lucide-react';
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

interface SuggestedRelationshipsSectionProps {
  tableSchema: string;
  tableName: string;
  dataSource: string;
  disabled?: boolean;
}

export default function SuggestedRelationshipsSection({
  tableSchema,
  tableName,
  dataSource,
  disabled,
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
      <h2 className="font-semibold text-foreground text-sm+">
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
                  <p className="py-6 text-center text-muted-foreground text-sm">
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
                    <div className="flex flex-col flex-wrap gap-0.5 text-muted-foreground text-sm">
                      <span>{suggestion.from}</span>
                      <ArrowDown className="h-4 w-4" />
                      <span>{suggestion.to}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <AddSuggestedRelationshipDialog
                      schema={tableSchema}
                      tableName={tableName}
                      source={dataSource}
                      defaultRelationshipName={suggestion.name}
                      disabled={disabled}
                      suggestion={suggestion.rawSuggestion}
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
