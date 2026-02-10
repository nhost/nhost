import {
  Download,
  FileJson,
  Info,
  Loader2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import ImportMetadataDialog from '@/features/orgs/projects/graphql/metadata/components/ImportMetadataDialog/ImportMetadataDialog';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';

export default function ImportExportMetadataCard() {
  const [isExporting, setIsExporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingImportMetadata, setPendingImportMetadata] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { project } = useProject();

  const handleExport = async () => {
    if (!project) {
      return;
    }

    setIsExporting(true);
    await execPromiseWithErrorToast(
      async () => {
        const appUrl = generateAppServiceUrl(
          project.subdomain,
          project.region,
          'hasura',
        );
        const data = await fetchExportMetadata({
          appUrl,
          adminSecret: project.config!.hasura.adminSecret,
        });

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const a = document.createElement('a');
        a.href = url;
        a.download = `metadata-export-${timestamp}.json`;
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

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const metadata = parsed.metadata ?? parsed;
        setPendingImportMetadata(metadata);
        setImportDialogOpen(true);
      } catch {
        console.error('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    processFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file?.name.endsWith('.json')) {
      processFile(file);
    }
  };

  return (
    <div className="rounded-lg border bg-paper p-4">
      <h3 className="mb-4 font-medium text-foreground text-sm">
        Import & Export Metadata
      </h3>

      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
            <Upload className="h-4 w-4 text-amber-500" />
          </div>
          <h4 className="font-medium text-foreground text-sm">Import</h4>
        </div>
        <p className="text-muted-foreground text-sm">
          Replace your existing metadata with the contents of an uploaded JSON
          file.
        </p>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-muted-foreground text-xs">
              Importing will overwrite all existing metadata. Make sure to
              export a backup first.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={cn(
            'flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <FileJson className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-medium text-foreground text-sm">
            Drop a .json file here
          </p>
          <p className="text-muted-foreground text-xs">or click to browse</p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Download className="h-4 w-4 text-primary" />
            </div>
            <h4 className="font-medium text-foreground text-sm">Export</h4>
          </div>
          <p className="text-muted-foreground text-sm">
            Download your current metadata as a JSON file for backup or version
            control.
          </p>
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-muted-foreground text-xs">
                Includes tracked tables, relationships, permissions, event
                triggers, and remote schemas.
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
      </div>

      <ImportMetadataDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        metadata={pendingImportMetadata}
        onImportSuccess={() => setPendingImportMetadata(null)}
      />
    </div>
  );
}
