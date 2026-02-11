import { Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import ResetMetadataDialog from '@/features/orgs/projects/graphql/metadata/components/ResetMetadataDialog/ResetMetadataDialog';

export default function ResetMetadataCard() {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-paper p-4">
      <h3 className="font-medium text-foreground text-lg">Reset Metadata</h3>

      <p className="mb-4 max-w-prose text-pretty text-muted-foreground">
        Reset all metadata and start fresh. This will remove all tracked tables,
        relationships, permissions, and other configuration from the GraphQL
        engine.
      </p>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 shrink-0 text-amber-500" />
          <p className="text-pretty text-muted-foreground text-sm">
            This action is irreversible. Make sure to export a backup before
            resetting metadata.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setClearDialogOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Reset Metadata
        </Button>
        <span className="text-muted-foreground text-sm">
          This action cannot be undone
        </span>
      </div>

      <ResetMetadataDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
      />
    </div>
  );
}
