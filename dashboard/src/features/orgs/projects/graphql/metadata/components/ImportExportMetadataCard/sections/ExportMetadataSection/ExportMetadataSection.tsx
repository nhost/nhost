import { Download, Info, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export default function ExportMetadataSection() {
  const [isExporting, setIsExporting] = useState(false);
  const { project } = useProject();

  const handleExport = async () => {
    setIsExporting(true);
    await execPromiseWithErrorToast(
      async () => {
        const appUrl = generateAppServiceUrl(
          project!.subdomain,
          project!.region,
          'hasura',
        );
        const data = await fetchExportMetadata({
          appUrl,
          adminSecret: project!.config!.hasura.adminSecret,
        });

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const a = document.createElement('a');
        a.href = url;
        a.download = `metadata-export-${project!.subdomain}-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      {
        loadingMessage: 'Exporting metadata...',
        successMessage: 'Metadata exported successfully.',
        errorMessage: 'Failed to export metadata.',
      },
    );
    setIsExporting(false);
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Download className="size-5 text-primary" />
        </div>
        <h4 className="font-medium text-foreground text-lg">Export</h4>
      </div>
      <p className="max-w-prose text-pretty text-muted-foreground">
        Download your current metadata as a JSON file for backup or version
        control.
      </p>
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <Info className="size-5 shrink-0 text-primary" />
          <p className="text-muted-foreground text-sm">
            Includes tracked tables, relationships, permissions, event triggers,
            and remote schemas.
          </p>
        </div>
      </div>
      <Button
        onClick={handleExport}
        disabled={isExporting}
        variant="outline"
        className="mt-auto w-full"
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Export Metadata
          </>
        )}
      </Button>
    </div>
  );
}
