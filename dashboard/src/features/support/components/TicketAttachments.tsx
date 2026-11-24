import { Download, FilePlus2, Paperclip, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { SupportError } from '@/features/support/components/SupportArea';
import SupportAttachmentPreview from '@/features/support/components/SupportAttachmentPreview';
import SupportImageViewer from '@/features/support/components/SupportImageViewer';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import type { SupportTicketAttachmentsController } from '@/features/support/hooks/use-support-ticket-attachments';
import { isSupportImage, type SupportAttachmentFile, type SupportAttachmentScope } from '@/features/support/utils/attachments';
import { supportDate } from '@/features/support/utils/tickets';
import { cn } from '@/lib/utils';

interface TicketAttachmentsProps {
  controller: SupportTicketAttachmentsController;
  closed: boolean;
  compact?: boolean;
  scope?: SupportAttachmentScope;
  onInsert?: (file: SupportAttachmentFile) => void;
}

export default function TicketAttachments({
  controller,
  closed,
  compact = false,
  scope,
  onInsert,
}: TicketAttachmentsProps) {
  const inputId = useId();
  const { role } = useSupportSession();
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const [previewID, setPreviewID] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const {
    attachments,
    files,
    uploads,
    download,
    uploading,
    unavailable,
    uploadFiles,
    removeUpload,
  } = controller;
  const previewFile = attachments.isError
    ? undefined
    : files.find((attachment) => attachment.file?.id === previewID)?.file;
  function downloadFile(file: SupportAttachmentFile) {
    void execPromiseWithErrorToast(
      () => download.mutateAsync({ id: file.id, name: file.name ?? 'attachment' }),
      {
        loadingMessage: 'Downloading attachment…',
        successMessage: 'Attachment downloaded',
        errorMessage: 'Unable to download this attachment. Your access may have changed.',
      },
    );
  }
  const pendingUploads = uploads.filter(
    (item) => !compact || item.status !== 'uploaded',
  );
  if (
    compact &&
    !attachments.isError &&
    !attachments.isLoading &&
    files.length === 0 &&
    pendingUploads.length === 0
  ) {
    return null;
  }
  return (
    <section
      aria-label="Ticket attachments"
      className={cn('space-y-4 rounded-lg border', compact ? 'p-4' : 'p-5')}
    >
      <h2 className="flex items-center gap-2 font-semibold text-sm">
        {compact ? (
          <>
            Attachments
            {!attachments.isError &&
              !attachments.isLoading &&
              ` · ${files.length}${attachments.hasNextPage ? '+' : ''}`}
          </>
        ) : (
          <>
            <Paperclip className="size-4" /> Attachments
          </>
        )}
      </h2>
      {attachments.isError ? (
        <SupportError
          message="Unable to load attachments. Your access may have changed."
          retry={() => {
            void attachments.refetch();
          }}
        />
      ) : attachments.isLoading ? (
        <Spinner>Loading attachments…</Spinner>
      ) : (
        <>
          {files.length === 0 && (
            <p className="text-muted-foreground text-sm">No attachments yet.</p>
          )}
          <ul className="space-y-3">
            {files.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {compact && scope && attachment.file && isSupportImage(attachment.file.mimeType ?? '') ? (
                    <button
                      type="button"
                      aria-label={`View ${attachment.file.name ?? 'attachment'} full size`}
                      className="shrink-0 cursor-pointer rounded-md border hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={(event) => {
                        previewTrigger.current = event.currentTarget;
                        setPreviewID(attachment.file?.id);
                        setPreviewOpen(true);
                      }}
                    >
                      <SupportAttachmentPreview file={attachment.file} className="size-8 border-0" />
                    </button>
                  ) : (
                    <SupportAttachmentPreview
                      file={attachment.file}
                      className={compact ? 'size-8' : undefined}
                    />
                  )}
                  <div className="min-w-0">
                    <p className={compact ? 'truncate text-muted-foreground text-xs' : 'break-words'}>
                      {attachment.file?.name ?? 'Attachment unavailable'}
                    </p>
                    {!compact && (
                      <p className="text-muted-foreground text-xs">
                        {attachment.file &&
                          `${attachment.file.size?.toLocaleString() ?? 'Unknown size'} bytes · `}
                        {attachment.uploaderName} ·{' '}
                        {supportDate(attachment.createdAt)}
                      </p>
                    )}
                  </div>
                </div>
                {attachment.file && (
                  <div className="flex shrink-0 gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="subtle"
                          disabled={download.status === 'loading'}
                          aria-label={`Download ${attachment.file.name ?? 'attachment'}`}
                          onClick={() => {
                            const file = attachment.file;
                            if (!file) {
                              return;
                            }
                            downloadFile(file);
                          }}
                        >
                          <Download className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download</TooltipContent>
                    </Tooltip>
                    {!closed && onInsert && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="subtle"
                            disabled={unavailable}
                            aria-label={`Insert ${attachment.file.name ?? 'attachment'} into reply`}
                            onClick={() =>
                              attachment.file && onInsert(attachment.file)
                            }
                          >
                            <FilePlus2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add to reply</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {attachments.hasNextPage && (
            <Button
              type="button"
              variant="outline"
              disabled={attachments.isFetchingNextPage}
              onClick={() => {
                void attachments.fetchNextPage();
              }}
            >
              Load more attachments
            </Button>
          )}
        </>
      )}
      {!closed && (!compact || pendingUploads.length > 0) && (
        <div className="space-y-3 border-t pt-4">
          {!compact && (
            <>
              <label htmlFor={inputId} className="font-medium text-sm">
                Attach files
              </label>
              <Input
                id={inputId}
                type="file"
                multiple
                disabled={unavailable}
                aria-describedby={`${inputId}-help`}
                onChange={(event) => {
                  const input = event.currentTarget;
                  const selected = Array.from(input.files ?? []);
                  input.value = '';
                  if (selected.length > 0) {
                    void uploadFiles(selected);
                  }
                }}
              />
              <p
                id={`${inputId}-help`}
                className="text-muted-foreground text-xs"
              >
                Drop files onto your reply or select them here to upload
                automatically. Up to 5 MB per file. Visible to everyone with
                access to this ticket. Uploads do not send a reply or change
                ticket status. Do not include secrets.
              </p>
            </>
          )}
          <ul className="space-y-2" aria-live="polite">
            {pendingUploads.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0 break-words">
                  <span>{item.file.name}</span>
                  <p className="text-muted-foreground text-xs">
                    {item.error ??
                      (
                        {
                          pending: 'Ready to upload',
                          uploading: 'Uploading…',
                          uploaded: 'Uploaded',
                          failed: 'Upload failed',
                          invalid: 'Invalid file',
                        } as const
                      )[item.status]}
                  </p>
                </div>
                {item.status !== 'uploaded' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${item.file.name}`}
                    disabled={uploading}
                    onClick={() => removeUpload(item.id)}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {!uploading &&
            uploads.some(
              (item) => item.status === 'pending' || item.status === 'failed',
            ) && (
              <ButtonWithLoading
                type="button"
                variant="outline"
                loading={uploading}
                disabled={unavailable}
                onClick={() => {
                  void uploadFiles();
                }}
              >
                Retry failed uploads
              </ButtonWithLoading>
            )}
        </div>
      )}
      {scope && previewFile && (
        <SupportImageViewer
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          trigger={previewTrigger}
          file={previewFile}
          filename={previewFile.name ?? 'Attachment'}
          scope={scope}
          requestRole={role}
          onDownload={() => downloadFile(previewFile)}
          downloading={download.status === 'loading'}
        />
      )}
    </section>
  );
}
