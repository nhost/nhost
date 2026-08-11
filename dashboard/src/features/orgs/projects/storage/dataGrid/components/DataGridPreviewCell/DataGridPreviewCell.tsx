import type { ReactNode } from 'react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { previewableFileTypes } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell/constants';
import FilePreviewDialog from '@/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell/FilePreviewDialog';
import ViewFileButton from '@/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell/ViewFileButton';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getFileUrlOrFallback } from './utils';

export type PreviewProps = {
  fetchBlob: (
    init: RequestInit,
    size?: { width?: number; height?: number },
  ) => Promise<Blob | null>;
  mimeType?: string;
  alt?: string;
  blob?: Blob;
  id: string;
};

export type DataGridPreviewCellProps = PreviewProps & {
  fallbackPreview?: ReactNode;
  isDisabled: boolean;
  downloadExpiration: number;
  presignedUrlsEnabled?: boolean;
};

export default function DataGridPreviewCell({
  fetchBlob,
  blob,
  mimeType,
  id,
  alt,
  fallbackPreview,
  isDisabled,
  downloadExpiration,
  presignedUrlsEnabled,
}: DataGridPreviewCellProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const appClient = useAppClient();
  const { project } = useProject();

  const isPreviewable = previewableFileTypes.some(
    (type) => mimeType?.startsWith(type) || mimeType === type,
  );

  async function handleOpenPreview() {
    if (!mimeType) {
      toast.error('File preview unavailable: unknown file type.');
      return;
    }

    if (isPreviewable) {
      setIsDialogOpen(true);
      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        try {
          const url = await getFileUrlOrFallback({
            appClient,
            id,
            adminSecret: project!.config!.hasura.adminSecret,
            presignedUrlsEnabled,
          });

          window.open(url, '_blank', 'noopener noreferrer');

          // Clean up the object URL after a delay (e.g. 60 seconds) to ensure the browser has time to load it
          if (url.startsWith('blob:')) {
            setTimeout(() => {
              URL.revokeObjectURL(url);
            }, 60000);
          }
        } catch (err) {
          throw new Error(
            `Could not open file. ${err instanceof Error ? err.message : 'Unknown error'}`,
          );
        }
      },
      {
        loadingMessage: 'Opening file...',
        successMessage: 'File opened in a new tab.',
        errorMessage: 'Could not open file.',
      },
    );
  }

  return (
    <>
      <ViewFileButton
        fetchBlob={fetchBlob}
        blob={blob}
        mimeType={mimeType}
        id={id}
        alt={alt}
        fallbackPreview={fallbackPreview}
        isDisabled={isDisabled}
        onClick={handleOpenPreview}
      />
      <FilePreviewDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        id={id}
        mimeType={mimeType}
        alt={alt}
        downloadExpiration={downloadExpiration}
        presignedUrlsEnabled={presignedUrlsEnabled}
      />
    </>
  );
}
