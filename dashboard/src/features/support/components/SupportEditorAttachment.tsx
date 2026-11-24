import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Maximize2, Paperclip, X } from 'lucide-react';
import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/v3/dialog';
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import SupportAttachmentPreview from '@/features/support/components/SupportAttachmentPreview';
import {
  type SupportRole,
  useSupportSession,
} from '@/features/support/hooks/use-support-session';
import {
  isSupportImage,
  MAX_SUPPORT_ATTACHMENT_SIZE,
  type SupportAttachmentFile,
  type SupportAttachmentScope,
  saveSupportAttachment,
} from '@/features/support/utils/attachments';
import {
  DashboardSupportInlineAttachmentDocument,
  type DashboardSupportInlineAttachmentQuery,
} from '@/generated/graphql';
import { cn } from '@/lib/utils';

interface SupportEditorAttachmentProps {
  id: string;
  name: string;
  scope?: SupportAttachmentScope;
  uploading: boolean;
  disabled: boolean;
  onRemove: VoidFunction;
  draftActions?: boolean;
  removalBlocked?: boolean;
}

export default function SupportEditorAttachment({
  id,
  name,
  scope,
  uploading,
  disabled,
  onRemove,
  draftActions = false,
  removalBlocked = false,
}: SupportEditorAttachmentProps) {
  const { user, role, request, downloadAttachment } = useSupportSession();
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewButton = useRef<HTMLButtonElement>(null);
  const requestRole = scope?.draftId ? 'user' : role;
  const attachment = useQuery({
    queryKey: [
      'support',
      user?.id,
      requestRole,
      'inline-attachment',
      scope?.ticketId,
      scope?.draftId,
      id,
      false,
    ],
    queryFn: async ({ signal }) => {
      if (!scope) {
        throw new Error('Attachment unavailable.');
      }
      const result = await request<DashboardSupportInlineAttachmentQuery>(
        DashboardSupportInlineAttachmentDocument,
        {
          id,
          scope: scope.ticketId
            ? { ticketID: { _eq: scope.ticketId } }
            : { draftID: { _eq: scope.draftId } },
        },
        signal,
        requestRole,
      );
      const file = result.supportAttachmentUploads[0]?.file;
      if (!file) {
        throw new Error('Attachment unavailable.');
      }
      return { file };
    },
    enabled: !!user && !!scope && !uploading,
    cacheTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  // Only verified, retained reservations may reach the private thumbnail loader.
  const file = !attachment.isError ? attachment.data?.file : undefined;
  const image = !!file && isSupportImage(file.mimeType ?? '');
  const filename = file?.name ?? name;

  const download = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error('Attachment unavailable.');
      }
      const bytes = await downloadAttachment(file.id, requestRole);
      saveSupportAttachment(bytes, filename);
    },
  });
  function startDownload() {
    if (!file || download.isLoading) {
      return;
    }
    void execPromiseWithErrorToast(() => download.mutateAsync(), {
      loadingMessage: 'Downloading attachment…',
      successMessage: 'Attachment downloaded',
      errorMessage: 'Unable to download this attachment.',
    });
  }
  const showRemove = !disabled && (!draftActions || !!file);
  const showPreview = draftActions && !!file;
  return (
    <span
      contentEditable={false}
      draggable={!disabled && !uploading}
      className={cn(
        'group/attachment relative my-2 inline-flex max-w-full items-center rounded-md border align-middle hover:border-primary/50',
        !image && !uploading && 'gap-2 bg-muted/10 py-2 pr-10 pl-3 text-sm',
        !image && showPreview && 'pr-20',
        !disabled && !uploading && 'cursor-move',
      )}
    >
      {uploading ? (
        <Skeleton className="flex h-40 w-64 max-w-full items-center justify-center px-3">
          <span className="break-words text-muted-foreground text-sm">
            {name}
          </span>
        </Skeleton>
      ) : image ? (
        <SupportAttachmentPreview
          file={file}
          requestRole={requestRole}
          variant="editor"
          className="border-0"
        />
      ) : (
        <>
          {file ? (
            <SupportAttachmentPreview
              file={file}
              requestRole={requestRole}
              className="size-6 border-0 bg-transparent"
            />
          ) : (
            <Paperclip aria-hidden="true" className="size-4 shrink-0" />
          )}
          <span className="min-w-0 break-words">{filename}</span>
        </>
      )}
      {(!uploading || !draftActions) && (showPreview || showRemove) && (
        <span className="pointer-events-none absolute top-1 right-1 z-10 flex gap-1 opacity-0 focus-within:pointer-events-auto focus-within:opacity-100 group-hover/attachment:pointer-events-auto group-hover/attachment:opacity-100">
          {showPreview && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  ref={previewButton}
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={
                    image
                      ? `View ${filename} full size`
                      : `Download ${filename}`
                  }
                  disabled={!image && download.isLoading}
                  className={cn(
                    cardActionClass,
                    'hover:bg-accent hover:text-foreground',
                  )}
                  onMouseDown={keepEditorSelection}
                  onClick={image ? () => setPreviewOpen(true) : startDownload}
                >
                  {image ? (
                    <Maximize2 aria-hidden="true" className="size-4" />
                  ) : (
                    <Download aria-hidden="true" className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {image ? 'View full size' : 'Download'}
              </TooltipContent>
            </Tooltip>
          )}
          {showRemove && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={removalBlocked}
                  aria-label={`Remove ${filename}`}
                  className={cn(
                    cardActionClass,
                    'hover:bg-destructive/10 hover:text-destructive',
                  )}
                  onMouseDown={keepEditorSelection}
                  onClick={onRemove}
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove</TooltipContent>
            </Tooltip>
          )}
        </span>
      )}
      {showPreview && image && file && scope && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent
            aria-describedby={undefined}
            className="w-fit max-w-[90vw] bg-background"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              previewButton.current?.focus();
            }}
          >
            <DialogTitle className="truncate pr-8 text-sm">
              {filename}
            </DialogTitle>
            {previewOpen && (
              <FullSizeImage
                file={file}
                filename={filename}
                draftId={scope.draftId}
                requestRole={requestRole}
                onDownload={startDownload}
                downloading={download.isLoading}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </span>
  );
}

const cardActionClass =
  'size-8 cursor-pointer border bg-background text-muted-foreground';

function keepEditorSelection(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

interface FullSizeImageProps {
  file: SupportAttachmentFile;
  filename: string;
  draftId?: string;
  requestRole: SupportRole;
  onDownload: VoidFunction;
  downloading: boolean;
}

function FullSizeImage({
  file,
  filename,
  draftId,
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
      draftId,
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
