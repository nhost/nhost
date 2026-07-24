import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { ResetMetadataDialog } from '@/features/orgs/projects/graphql/metadata/components/ResetMetadataDialog';

export default function ResetMetadataCard() {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-paper p-4">
      <h3 className="font-medium text-foreground text-lg">Reset Metadata</h3>

      <p className="mb-4 max-w-prose text-pretty text-muted-foreground">
        Reset all metadata and start fresh. This will remove all tracked tables,
        relationships, permissions, and other configuration from the GraphQL
        engine.
      </p>

      <Alert variant="warning">
        <TriangleAlert className="size-5" />
        <AlertDescription className="text-pretty text-muted-foreground">
          This action is irreversible. Make sure to export a backup before
          resetting metadata.
        </AlertDescription>
      </Alert>

      <div className="mt-4 flex items-center justify-between gap-2">
        <ResetMetadataDialog />
        <span className="text-muted-foreground text-sm">
          This action cannot be undone
        </span>
      </div>
    </div>
  );
}
