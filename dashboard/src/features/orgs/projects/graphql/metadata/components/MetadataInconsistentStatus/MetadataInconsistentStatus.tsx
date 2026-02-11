import {
  ChevronDown,
  ChevronRight,
  Info,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import DeleteInconsistentObjectsDialog from '@/features/orgs/projects/graphql/metadata/components/DeleteInconsistentObjectsDialog/DeleteInconsistentObjectsDialog';
import InconsistentObjectDefinitionDialog from '@/features/orgs/projects/graphql/metadata/components/InconsistentObjectDefinitionDialog/InconsistentObjectDefinitionDialog';

interface MetadataInconsistentStatusProps {
  inconsistentObjects: unknown[];
}

export default function MetadataInconsistentStatus({
  inconsistentObjects,
}: MetadataInconsistentStatusProps) {
  const [inconsistenciesTableOpen, setInconsistenciesTableOpen] =
    useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
                  <TriangleAlert className="h-4 w-4 text-destructive" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">
                  Some objects in your metadata reference database tables or
                  remote schemas that no longer exist or have conflicting
                  definitions. Your GraphQL API is currently serving only the
                  consistent portions of the metadata.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div>
            <h3 className="font-medium text-foreground text-sm">
              Metadata Status
            </h3>
            <p className="text-muted-foreground text-xs">
              {inconsistentObjects.length} inconsistenc
              {inconsistentObjects.length === 1 ? 'y' : 'ies'} detected
            </p>
          </div>
        </div>
        <Badge variant="destructive">Inconsistent</Badge>
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-destructive" />
            <h4 className="font-medium text-foreground text-sm">
              How to resolve
            </h4>
          </div>
          <ol className="mt-2 list-decimal space-y-1 pl-8 text-muted-foreground text-sm">
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
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inconsistentObjects.map((item, index) => {
                        const obj = item as Record<string, unknown>;
                        return (
                          <TableRow
                            key={`${String(obj.type)}-${String(obj.name)}-${index}`}
                          >
                            <TableCell className="font-medium">
                              {String(obj.name)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {String(obj.type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {String(obj.reason)}
                            </TableCell>
                            <TableCell>
                              <InconsistentObjectDefinitionDialog
                                definition={obj.definition}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove Inconsistent Metadata
          </Button>
          <p className="text-muted-foreground text-xs">
            This action cannot be undone
          </p>

          <DeleteInconsistentObjectsDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          />
        </div>
      </div>
    </>
  );
}
