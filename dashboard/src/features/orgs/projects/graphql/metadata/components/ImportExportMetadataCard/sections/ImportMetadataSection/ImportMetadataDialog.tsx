import { FileJson } from 'lucide-react';
import type { ChangeEvent, DragEvent } from 'react';
import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { Label } from '@/components/ui/v3/label';
import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';
import { useReplaceMetadataMutation } from '@/features/orgs/projects/graphql/metadata/hooks/useReplaceMetadataMutation';
import { readMetadataFile } from '@/features/orgs/projects/graphql/metadata/utils/readMetadataFile';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import { getToastStyleProps } from '@/utils/constants/settings';

export default function ImportMetadataDialog() {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingMetadata, setPendingMetadata] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [allowInconsistentMetadata, setAllowInconsistentMetadata] =
    useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: oldMetadata } = useGetMetadata();

  const { isPending: isReplacing, mutateAsync: replaceMetadata } =
    useReplaceMetadataMutation();

  const processFile = async (file: File) => {
    try {
      const metadata = await readMetadataFile(file);
      setPendingMetadata(metadata);
      setDialogOpen(true);
    } catch (error) {
      toast.error(
        error?.message || 'Failed to parse metadata.',
        getToastStyleProps(),
      );
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processFile(file!);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    processFile(file);
  };

  const handleImportConfirm = async () => {
    await execPromiseWithErrorToast(
      async () => {
        await replaceMetadata({
          oldMetadata,
          metadata: pendingMetadata!,
          allowInconsistentMetadata,
        });
        setDialogOpen(false);
        setPendingMetadata(null);
        setAllowInconsistentMetadata(false);
      },
      {
        loadingMessage: 'Importing metadata...',
        successMessage: 'Metadata imported successfully.',
        errorMessage: 'Failed to import metadata.',
      },
    );
  };

  return (
    <>
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          setAllowInconsistentMetadata(false);
        }}
      >
        <DialogContent
          className="sm:max-w-[425px]"
          hideCloseButton
          disableOutsideClick
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Import Metadata
            </DialogTitle>
            <DialogDescription>
              This will replace all current metadata with the imported file.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="allow-inconsistent-metadata"
              checked={allowInconsistentMetadata}
              onCheckedChange={(checked) =>
                setAllowInconsistentMetadata(Boolean(checked))
              }
            />
            <Label
              htmlFor="allow-inconsistent-metadata"
              className="cursor-pointer font-normal text-foreground text-sm"
            >
              Allow inconsistent metadata
            </Label>
          </div>
          <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
            <ButtonWithLoading
              className="!text-sm+"
              loading={isReplacing}
              onClick={handleImportConfirm}
            >
              Import
            </ButtonWithLoading>
            <DialogClose asChild>
              <Button variant="outline" className="!text-sm+ text-foreground">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
