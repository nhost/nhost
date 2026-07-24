import { TriangleAlert, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import ImportMetadataDialog from '@/features/orgs/projects/graphql/metadata/components/ImportExportMetadataCard/sections/ImportMetadataSection/ImportMetadataDialog';

export default function ImportMetadataSection() {
  return (
    <div className="flex flex-col gap-4 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
          <Upload className="size-5 text-amber-500" />
        </div>
        <h4 className="font-medium text-foreground text-lg">Import</h4>
      </div>
      <p className="max-w-prose text-muted-foreground">
        Replace your existing metadata with the contents of an uploaded JSON
        file.
      </p>
      <Alert variant="warning">
        <TriangleAlert className="size-5" />
        <AlertDescription className="text-muted-foreground">
          Importing will overwrite all existing metadata. Make sure to export a
          backup first.
        </AlertDescription>
      </Alert>
      <ImportMetadataDialog />
    </div>
  );
}
