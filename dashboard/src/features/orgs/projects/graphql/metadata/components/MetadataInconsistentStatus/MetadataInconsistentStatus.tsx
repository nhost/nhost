import { ChevronDown, ChevronRight, Info, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { DeleteInconsistentObjectsDialog } from '@/features/orgs/projects/graphql/metadata/components/DeleteInconsistentObjectsDialog';
import { InconsistentObjectDefinitionDialog } from '@/features/orgs/projects/graphql/metadata/components/InconsistentObjectDefinitionDialog';
import type { InconsistentObject } from '@/utils/hasura-api/generated/schemas';

interface MetadataInconsistentStatusProps {
  inconsistentObjects: InconsistentObject[];
}

export default function MetadataInconsistentStatus({
  inconsistentObjects,
}: MetadataInconsistentStatusProps) {
  const [inconsistenciesTableOpen, setInconsistenciesTableOpen] =
    useState(false);

  const label =
    inconsistentObjects.length === 1 ? 'inconsistency' : 'inconsistencies';
  const inconsistencyCountText = `${inconsistentObjects.length} ${label} detected`;

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
            <TriangleAlert className="size-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-medium text-foreground text-lg">
              Metadata Status
            </h3>
            <p className="text-muted-foreground text-sm">
              {inconsistencyCountText}
            </p>
          </div>
        </div>
        <Badge variant="destructive">Inconsistent</Badge>
      </div>
      <p className="max-w-prose text-pretty pt-2 text-muted-foreground">
        Some objects in your metadata reference database or remote schema
        objects that no longer exist or have conflicting definitions.
      </p>
      <p className="max-w-prose text-pretty pt-2 text-muted-foreground">
        Your GraphQL API is currently serving only the consistent portions of
        the metadata.
      </p>

      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-center gap-2">
            <Info className="size-4 shrink-0 text-destructive" />
            <h4 className="font-medium text-foreground">How to resolve</h4>
          </div>
          <ol className="mt-2 list-decimal space-y-1 pl-8 text-muted-foreground">
            <li>
              Manually fix the underlying issues (e.g. recreate missing tables
              or remote schemas), then reload metadata.
            </li>
            <li>
              Or remove all inconsistent objects from metadata using the button
              below.
            </li>
          </ol>
        </div>

        {inconsistentObjects.length > 0 && (
          <Collapsible
            open={inconsistenciesTableOpen}
            onOpenChange={setInconsistenciesTableOpen}
          >
            <div className="rounded-lg border">
              <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50">
                <span className="font-medium text-foreground text-sm">
                  View inconsistent objects ({inconsistentObjects.length})
                </span>
                {inconsistenciesTableOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inconsistentObjects.map((obj, index) => (
                        <TableRow key={`${obj.type}-${obj.name}-${index}`}>
                          <TableCell className="font-medium">
                            {obj.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{obj.type}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {obj.reason}
                          </TableCell>
                          <TableCell>
                            <InconsistentObjectDefinitionDialog
                              name={obj.name}
                              definition={obj.definition}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        <div className="flex items-center justify-between gap-2">
          <DeleteInconsistentObjectsDialog />
          <span className="text-muted-foreground text-sm">
            This action cannot be undone
          </span>
        </div>
      </div>
    </>
  );
}
