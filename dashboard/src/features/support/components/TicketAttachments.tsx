import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Download, Paperclip, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { SupportError } from '@/features/support/components/SupportArea';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import {
  attachmentValidationError,
  saveSupportAttachment,
} from '@/features/support/utils/attachments';
import { supportDate } from '@/features/support/utils/tickets';
import {
  DashboardReserveSupportAttachmentDocument,
  type DashboardReserveSupportAttachmentMutation,
  DashboardSupportAttachmentsDocument,
  type DashboardSupportAttachmentsQuery,
} from '@/generated/graphql';

interface TicketAttachmentsProps {
  ticketId: string;
  closed: boolean;
  disabled: boolean;
}

interface AttachmentUpload {
  id: number;
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'invalid';
  error?: string;
}

export default function TicketAttachments({
  ticketId,
  closed,
  disabled,
}: TicketAttachmentsProps) {
  const { queryKey, request, uploadAttachment, downloadAttachment } =
    useSupportSession();
  const client = useQueryClient();
  const inputId = useId();
  const nextUploadId = useRef(0);
  const [uploads, setUploads] = useState<AttachmentUpload[]>([]);
  const attachmentsKey = [...queryKey, 'attachments', ticketId];
  const attachments = useInfiniteQuery({
    queryKey: attachmentsKey,
    queryFn: async ({ pageParam = 0, signal }) => {
      const result = await request<DashboardSupportAttachmentsQuery>(
        DashboardSupportAttachmentsDocument,
        { ticketId, offset: pageParam },
        signal,
      );
      if (!result.supportTicket) {
        throw new Error('This ticket is no longer accessible.');
      }
      return result.supportTicket.attachments;
    },
    getNextPageParam: (last, pages) =>
      last.length === 100
        ? pages.reduce((count, page) => count + page.length, 0)
        : undefined,
    cacheTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  function updateUpload(id: number, changes: Partial<AttachmentUpload>) {
    setUploads((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, ...changes } : candidate,
      ),
    );
  }
  const upload = useMutation({
    retry: false,
    mutationFn: async () => {
      let failed = 0;
      // One file per request preserves per-file outcomes without multipart ambiguity.
      for (const item of uploads.filter(
        (candidate) =>
          candidate.status === 'pending' || candidate.status === 'failed',
      )) {
        updateUpload(item.id, { status: 'uploading', error: undefined });
        try {
          const reservation =
            await request<DashboardReserveSupportAttachmentMutation>(
              DashboardReserveSupportAttachmentDocument,
              { ticketId },
            );
          if (!reservation.insertSupportAttachmentUpload) {
            throw new Error('Unable to reserve an upload ID.');
          }
          await uploadAttachment(
            reservation.insertSupportAttachmentUpload.id,
            item.file,
          );
          updateUpload(item.id, { status: 'uploaded' });
        } catch (error: unknown) {
          console.error(
            'Support attachment upload failed',
            error instanceof Error ? error.message : 'Unknown error',
          );
          failed += 1;
          updateUpload(item.id, {
            status: 'failed',
            error:
              'Upload could not be confirmed. Check the attachment list before retrying.',
          });
        }
      }
      if (failed > 0) {
        throw new Error(
          `${failed} file upload(s) could not be confirmed. Successful files are kept. Check attachments before retrying the failed files.`,
        );
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: attachmentsKey }),
  });
  const download = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const blob = await downloadAttachment(id);
      saveSupportAttachment(blob, name);
    },
  });
  const uploading = upload.status === 'loading';
  const pending = uploads.some(
    (item) => item.status === 'pending' || item.status === 'failed',
  );
  const files = attachments.data?.pages.flat() ?? [];

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
                {attachment.file && (
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
            disabled={
              disabled ||
              uploading ||
              attachments.isError ||
              attachments.isLoading
            }
            aria-describedby={`${inputId}-help`}
            onChange={(event) => {
              const input = event.currentTarget;
              const selected = Array.from(input.files ?? []).map(
                (file): AttachmentUpload => {
                  const error = attachmentValidationError(file);
                  nextUploadId.current += 1;
                  return {
                    id: nextUploadId.current,
                    file,
                    status: error ? 'invalid' : 'pending',
                    error,
                  };
                },
              );
              setUploads((current) => [...current, ...selected]);
              input.value = '';
            }}
          />
          <p id={`${inputId}-help`} className="text-muted-foreground text-xs">
            Up to 5 MB per file. Visible to everyone with access to this ticket.
            Uploads do not send a reply or change ticket status. Do not include
            secrets.
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
                    onClick={() =>
                      setUploads((current) =>
                        current.filter((candidate) => candidate.id !== item.id),
                      )
                    }
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {pending && (
            <ButtonWithLoading
              type="button"
              variant="outline"
              loading={uploading}
              disabled={
                disabled || attachments.isError || attachments.isLoading
              }
              onClick={() => {
                void execPromiseWithErrorToast(() => upload.mutateAsync(), {
                  loadingMessage: 'Uploading files…',
                  successMessage: 'Files uploaded',
                  errorMessage: 'Unable to upload files.',
                });
              }}
            >
              Upload files
            </ButtonWithLoading>
          )}
        </div>
      )}
    </section>
  );
}
