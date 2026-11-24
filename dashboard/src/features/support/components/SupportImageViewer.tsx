import { useQuery } from '@tanstack/react-query';
import { type RefObject, useEffect, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/v3/dialog';
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  type SupportRole,
  useSupportSession,
} from '@/features/support/hooks/use-support-session';
import {
  isSupportImage,
  MAX_SUPPORT_ATTACHMENT_SIZE,
  type SupportAttachmentFile,
  type SupportAttachmentScope,
} from '@/features/support/utils/attachments';

interface SupportImageViewerProps extends FullSizeImageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: RefObject<HTMLButtonElement | null>;
}

export default function SupportImageViewer({
  open,
  onOpenChange,
  trigger,
  file,
  filename,
  scope,
  requestRole,
  onDownload,
  downloading,
}: SupportImageViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="w-fit max-w-[90vw] bg-background"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus({ preventScroll: true });
        }}
      >
        <DialogTitle className="truncate pr-8 text-sm">{filename}</DialogTitle>
        {open && (
          <FullSizeImage
            file={file}
            filename={filename}
            scope={scope}
            requestRole={requestRole}
            onDownload={onDownload}
            downloading={downloading}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FullSizeImageProps {
  file: SupportAttachmentFile;
  filename: string;
  scope: SupportAttachmentScope;
  requestRole: SupportRole;
  onDownload: VoidFunction;
  downloading: boolean;
}

function FullSizeImage({
  file,
  filename,
  scope,
  requestRole,
  onDownload,
  downloading,
}: FullSizeImageProps) {
  const { user, downloadAttachment } = useSupportSession();
  const [image, setImage] = useState<{ bytes: Blob; url: string }>();
  const [failedURL, setFailedURL] = useState<string>();
  const preview = useQuery({
    queryKey: [
      'support',
      user?.id,
      requestRole,
      'full-size-image',
      scope.draftId,
      scope.ticketId,
      file.id,
      file.mimeType,
    ],
    queryFn: async ({ signal }) => {
      const mimeType = file.mimeType ?? '';
      if (!isSupportImage(mimeType)) {
        throw new Error('Attachment cannot be previewed.');
      }
      const bytes = await downloadAttachment(file.id, requestRole, signal);
      if (
        bytes.type !== mimeType ||
        bytes.size === 0 ||
        bytes.size > MAX_SUPPORT_ATTACHMENT_SIZE
      ) {
        throw new Error('The image preview is unavailable.');
      }
      return bytes;
    },
    enabled: !!user,
    cacheTime: 0,
    retry: false,
  });
  const bytes = !preview.isError ? preview.data : undefined;
  useEffect(() => {
    if (!bytes) {
      return undefined;
    }
    const url = URL.createObjectURL(bytes);
    setImage({ bytes, url });
    return () => URL.revokeObjectURL(url);
  }, [bytes]);

  if (preview.isError || (image && image.url === failedURL)) {
    return (
      <div className="flex flex-col items-center gap-3 p-4 text-sm">
        <p role="alert">Couldn't load this image.</p>
        <Button
          type="button"
          variant="outline"
          aria-label={`Download ${filename}`}
          disabled={downloading}
          onClick={onDownload}
        >
          Download
        </Button>
      </div>
    );
  }
  if (!image || image.bytes !== bytes) {
    return <Skeleton aria-label="Loading image" className="mx-auto size-40" />;
  }
  return (
    // biome-ignore lint/performance/noImgElement: Private authenticated blob URLs must not go through the image optimizer.
    <img
      src={image.url}
      alt={filename}
      draggable={false}
      className="mx-auto max-h-[85vh] max-w-[90vw] object-contain"
      onError={() => setFailedURL(image.url)}
    />
  );
}
