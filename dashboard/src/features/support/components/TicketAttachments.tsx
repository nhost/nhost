import { Download, FilePlus2, Paperclip, X } from 'lucide-react';
import { useId } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { SupportError } from '@/features/support/components/SupportArea';
import SupportAttachmentPreview from '@/features/support/components/SupportAttachmentPreview';
import type { SupportTicketAttachmentsController } from '@/features/support/hooks/use-support-ticket-attachments';
import type { SupportAttachmentFile } from '@/features/support/utils/attachments';
import { supportDate } from '@/features/support/utils/tickets';

interface TicketAttachmentsProps {
  controller: SupportTicketAttachmentsController;
  closed: boolean;
  onInsert?: (file: SupportAttachmentFile) => void;
}

export default function TicketAttachments({
  controller,
  closed,
  onInsert,
}: TicketAttachmentsProps) {
  const inputId = useId();
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
  return (
    <section
      aria-label="Ticket attachments"
      className="space-y-4 rounded-lg border p-5"
    >
      <h2 className="flex items-center gap-2 font-semibold text-sm">
        <Paperclip className="size-4" /> Attachments
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
                  <SupportAttachmentPreview file={attachment.file} />
                  <div className="min-w-0">
                    <p className="break-words">
                      {attachment.file?.name ?? 'Attachment unavailable'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {attachment.file &&
                        `${attachment.file.size?.toLocaleString() ?? 'Unknown size'} bytes · `}
                      {attachment.uploaderName} ·{' '}
                      {supportDate(attachment.createdAt)}
                    </p>
                  </div>
                </div>
                {attachment.file && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={download.status === 'loading'}
                      aria-label={`Download ${attachment.file.name ?? 'attachment'}`}
                      onClick={() => {
                        const file = attachment.file;
                        if (!file) {
                          return;
                        }
                        void execPromiseWithErrorToast(
                          () =>
                            download.mutateAsync({
                              id: file.id,
                              name: file.name ?? 'attachment',
                            }),
                          {
                            loadingMessage: 'Downloading attachment…',
                            successMessage: 'Attachment downloaded',
                            errorMessage:
                              'Unable to download this attachment. Your access may have changed.',
                          },
                        );
                      }}
                    >
                      <Download className="size-4" />
                    </Button>
                    {!closed && onInsert && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={unavailable}
                        aria-label={`Insert ${attachment.file.name ?? 'attachment'} into reply`}
                        onClick={() =>
                          attachment.file && onInsert(attachment.file)
                        }
                      >
                        <FilePlus2 className="size-4" />
                      </Button>
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
      {!closed && (
        <div className="space-y-3 border-t pt-4">
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
          <p id={`${inputId}-help`} className="text-muted-foreground text-xs">
            Drop files onto your reply or select them here to upload
            automatically. Up to 5 MB per file. Visible to everyone with access
            to this ticket. Uploads do not send a reply or change ticket status.
            Do not include secrets.
          </p>
          <ul className="space-y-2" aria-live="polite">
            {uploads.map((item) => (
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
    </section>
  );
}
