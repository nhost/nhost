import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { Spinner } from '@/components/ui/v3/spinner';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { previewableImages } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell/constants';
import { cn } from '@/lib/utils';

export type FilePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  mimeType?: string;
  alt?: string;
  downloadExpiration: number;
};

const PRESIGNED_URL_SAFETY_MARGIN_SECONDS = 10;

export default function FilePreviewDialog({
  open,
  onOpenChange,
  id,
  mimeType,
  alt,
  downloadExpiration,
}: FilePreviewDialogProps) {
  const appClient = useAppClient();
  const { project } = useProject();

  const {
    data: presignedUrl,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['file-presigned-url', id],
    queryFn: async () => {
      const { body } = await appClient.storage.getFilePresignedURL(id, {
        headers: {
          'x-hasura-admin-secret': project!.config!.hasura.adminSecret,
        },
      });

      if (!body?.url) {
        throw new Error('Presigned URL could not be fetched.');
      }

      return body.url;
    },
    enabled: open,
    staleTime: Math.max(
      0,
      (downloadExpiration - PRESIGNED_URL_SAFETY_MARGIN_SECONDS) * 1000,
    ),
  });

  const isVideo = mimeType?.startsWith('video');
  const isAudio = mimeType?.startsWith('audio');
  const isImage = mimeType?.startsWith('image');
  const isJson = mimeType === 'application/json';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeButtonClassName={cn({ 'text-white': isVideo || isAudio })}
        className={cn(
          { 'bg-checker-pattern': !isJson && !error },
          { 'p-0': isVideo || isAudio },
          isAudio ? '!w-auto' : 'h-[90vh] min-w-[96vw]',
          'flex items-center justify-center overflow-hidden rounded-md',
        )}
      >
        <DialogTitle className="hidden">{alt}</DialogTitle>
        <DialogDescription className="hidden">{alt}</DialogDescription>
        {loading && (
          <Spinner
            className={cn('h-5 w-5', { '!stroke-[#1e324b]': !isJson })}
            wrapperClassName={cn('flex-row gap-1 text-xs', {
              'text-disabled': isJson,
              'text-gray-600': !isJson,
            })}
          >
            Loading preview...
          </Spinner>
        )}
        {!!error && (
          <div className="!text-error-main px-6 py-3.5 pr-12 text-start font-medium">
            <p>Error: Preview can&apos;t be loaded.</p>
            <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        )}
        {presignedUrl && isImage && (
          <picture className="flex h-full max-h-full items-center justify-center">
            <source srcSet={presignedUrl} type={mimeType} />
            <img
              src={presignedUrl}
              alt={alt}
              className="h-full max-w-full object-contain"
            />
          </picture>
        )}
        {presignedUrl && isVideo && (
          <video
            autoPlay
            controls
            className="h-full w-full rounded-sm bg-black"
          >
            <track kind="captions" />
            <source src={presignedUrl} type={mimeType} />
            Your browser does not support the video tag.
          </video>
        )}
        {presignedUrl && isAudio && (
          <audio autoPlay controls className="h-28 bg-black">
            <track kind="captions" />
            <source src={presignedUrl} type={mimeType} />
            Your browser does not support the audio tag.
          </audio>
        )}
        {presignedUrl &&
          mimeType &&
          !previewableImages.includes(mimeType) &&
          !isVideo &&
          !isAudio && (
            <iframe
              src={presignedUrl}
              className="h-near-screen w-full"
              title="File preview"
            />
          )}
      </DialogContent>
    </Dialog>
  );
}
