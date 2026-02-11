import { FileJson, TriangleAlert, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import ImportMetadataDialog from '@/features/orgs/projects/graphql/metadata/components/ImportMetadataDialog/ImportMetadataDialog';
import { cn } from '@/lib/utils';

export default function ImportMetadataSection() {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingImportMetadata, setPendingImportMetadata] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <>
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
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-5 shrink-0 text-amber-500" />
            <p className="text-muted-foreground text-sm">
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
          <FileJson className="size-8 text-muted-foreground/50" />
          <p className="font-medium text-foreground">Drop a .json file here</p>
          <p className="text-muted-foreground text-sm">or click to browse</p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <ImportMetadataDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        metadata={pendingImportMetadata}
        onImportSuccess={() => setPendingImportMetadata(null)}
      />
    </>
  );
}
