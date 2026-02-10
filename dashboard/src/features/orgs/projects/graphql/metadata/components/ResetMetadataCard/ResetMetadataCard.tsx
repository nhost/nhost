import { Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import ResetMetadataDialog from '@/features/orgs/projects/graphql/metadata/components/ResetMetadataDialog/ResetMetadataDialog';

export default function ResetMetadataCard() {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-4 font-medium text-foreground text-sm">
        Reset Metadata
      </h3>

      <p className="mb-4 text-muted-foreground text-sm">
        Reset all metadata and start fresh. This will remove all tracked tables,
        relationships, permissions, and other configuration from the GraphQL
        engine.
      </p>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-muted-foreground text-xs">
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
        <p className="text-muted-foreground text-xs">
          This action cannot be undone
        </p>
      </div>

      <ResetMetadataDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
      />
    </div>
  );
}
