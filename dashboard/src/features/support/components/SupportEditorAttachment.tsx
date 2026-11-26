import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Maximize2, Paperclip, X } from 'lucide-react';
import { type MouseEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import SupportAttachmentPreview from '@/features/support/components/SupportAttachmentPreview';
import SupportImageViewer from '@/features/support/components/SupportImageViewer';
import { useSupportSession } from '@/features/support/hooks/useSupportSession';
import {
  isSupportImage,
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
  uploading?: boolean;
  disabled?: boolean;
  onRemove?: VoidFunction;
  compact?: boolean;
  reserveThumbnail?: boolean;
  draftActions?: boolean;
  removalBlocked?: boolean;
  /** The file as found in a list the parent already loaded; skips this chip's own check. */
  resolved?: { file?: SupportAttachmentFile; loading: boolean };
}

export default function SupportEditorAttachment({
  id,
  name,
  scope,
  uploading = false,
  disabled = false,
  onRemove,
  compact = false,
  reserveThumbnail = false,
  draftActions = false,
  removalBlocked = false,
  resolved,
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
    enabled: !!user && !!scope && !uploading && !resolved,
    cacheTime: 0,
    retry: false,
  });
  // Only verified, retained reservations may reach the private thumbnail loader.
  const file = resolved
    ? resolved.file
    : !attachment.isError
      ? attachment.data?.file
      : undefined;
  const unavailable = resolved
    ? !resolved.loading && !resolved.file
    : attachment.isError;
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
  const showRemove = !!onRemove && !disabled && (!draftActions || !!file);
  const showPreview = (draftActions || compact) && !!file;
  const clickThumbnail = compact && image;
  const showActionIcon = showPreview && !clickThumbnail;
  const compactThumbnail = compact && (image || (reserveThumbnail && !file));
  return (
    <span
      contentEditable={false}
      draggable={!compact && !disabled && !uploading}
      className={cn(
        'group/attachment relative my-2 inline-flex max-w-full items-center rounded-md border align-middle hover:border-primary/50',
        !image &&
          !uploading &&
          !compactThumbnail &&
          'gap-2 bg-muted/10 py-2 pr-10 pl-3 text-sm',
        !compact && !image && showPreview && 'pr-20',
        !compact && !disabled && !uploading && 'cursor-move',
        compact && 'not-prose my-1',
        compactThumbnail &&
          'h-20 w-28 justify-center overflow-hidden bg-muted/50',
      )}
    >
      {uploading ? (
        <Skeleton className="flex h-40 w-64 max-w-full items-center justify-center px-3">
          <span className="break-words text-muted-foreground text-sm">
            {name}
          </span>
        </Skeleton>
      ) : compactThumbnail ? (
        <SupportAttachmentPreview
          file={file}
          requestRole={requestRole}
          className="size-full border-0 bg-transparent"
          label={unavailable ? `Attachment unavailable: ${name}` : filename}
        />
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
          <span className="min-w-0 break-words">
            {compact && unavailable
              ? `Attachment unavailable: ${filename}`
              : filename}
          </span>
        </>
      )}
      {clickThumbnail && (
        <button
          ref={previewButton}
          type="button"
          aria-label={`View ${filename} full size`}
          className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onClick={() => setPreviewOpen(true)}
        />
      )}
      {(!uploading || !draftActions) && (showActionIcon || showRemove) && (
        <span className="pointer-events-none absolute top-1 right-1 z-10 flex gap-1 opacity-0 focus-within:pointer-events-auto focus-within:opacity-100 group-hover/attachment:pointer-events-auto group-hover/attachment:opacity-100">
          {showActionIcon && (
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
        <SupportImageViewer
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          trigger={previewButton}
          file={file}
          filename={filename}
          scope={scope}
          requestRole={requestRole}
          onDownload={startDownload}
          downloading={download.isLoading}
        />
      )}
    </span>
  );
}

const cardActionClass =
  'size-8 cursor-pointer border bg-background text-muted-foreground';

function keepEditorSelection(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}
