import { useMutation } from '@tanstack/react-query';
import { Download, Paperclip, X } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { SupportError } from '@/features/support/components/SupportArea';
import type { SupportAttachmentDraftController } from '@/features/support/hooks/use-support-attachment-draft';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import { saveSupportAttachment } from '@/features/support/utils/attachments';
import { supportDate } from '@/features/support/utils/tickets';

interface DraftAttachmentsProps {
  draft: SupportAttachmentDraftController;
  disabled: boolean;
}

export default function DraftAttachments({
  draft,
  disabled,
}: DraftAttachmentsProps) {
  const inputID = useId();
  const { downloadAttachment } = useSupportSession();
  const data = draft.query.data?.draft;
  const ticketID = draft.query.data?.ticketID;
  const unavailable =
    disabled || draft.busy || draft.query.isError || !!ticketID;
  const download = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const blob = await downloadAttachment(id, 'user');
      saveSupportAttachment(blob, name);
    },
  });
  async function perform(
    operation: Parameters<typeof draft.action.mutateAsync>[0],
    loadingMessage: string,
    successMessage: string,
  ) {
    await execPromiseWithErrorToast(() => draft.action.mutateAsync(operation), {
      loadingMessage,
      successMessage,
      errorMessage: 'Unable to update draft attachments. Please try again.',
    });
  }
  const queue = draft.uploads.filter((item) => item.status !== 'uploaded');
  const unidentified = draft.unfinished.filter(
    (item) => !draft.uploads.some((local) => local.reservationID === item.id),
  );

  return (
    <section
      aria-label="Draft attachments"
      className="space-y-4 rounded-lg border p-5"
    >
      <h2 className="flex items-center gap-2 font-semibold text-sm">
        <Paperclip className="size-4" /> Attachments
      </h2>
      <p className="text-muted-foreground text-xs">
        Upload files before creating the ticket. Draft files are private to you
        until submission. Up to 5 MB per file.
      </p>
      {draft.identity && draft.query.isError ? (
        <SupportError
          message="Unable to load draft attachments. The draft may already have created a ticket, or your access may have changed. Retry to check before starting another ticket."
          retry={() => {
            void draft.query.refetch();
          }}
        />
      ) : ticketID ? (
        <p className="text-sm">
          This draft already created a ticket.{' '}
          <Link href={`/support/tickets/${ticketID}`} className="underline">
            Open the created ticket
          </Link>
          .
        </p>
      ) : (
        <>
          {!!data?.attachments.length && (
            <ul className="space-y-3">
              {data.attachments.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 break-words">
                    <p>{item.file?.name ?? 'Attachment unavailable'}</p>
                    <p className="text-muted-foreground text-xs">
                      Uploaded
                      {item.file?.size != null
                        ? ` · ${item.file.size.toLocaleString()} bytes`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {item.file && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Download ${item.file.name ?? 'attachment'}`}
                        disabled={unavailable || download.status === 'loading'}
                        onClick={() => {
                          const file = item.file;
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
                                'Unable to download this attachment.',
                            },
                          );
                        }}
                      >
                        <Download className="size-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={unavailable}
                      aria-label={`Remove attachment ${item.file?.name ?? item.id}`}
                      onClick={() => {
                        void perform(
                          { type: 'discard', id: item.id },
                          'Removing attachment…',
                          'Attachment removed',
                        );
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {unidentified.map((item) => (
            <div key={item.id} className="space-y-2 text-sm">
              <p>
                Unfinished upload {item.id}. Remove it before submitting the
                ticket.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={unavailable}
                onClick={() => {
                  void perform(
                    { type: 'discard', id: item.id },
                    'Discarding unfinished upload…',
                    'Unfinished upload discarded',
                  );
                }}
              >
                Discard unfinished upload {item.id}
              </Button>
            </div>
          ))}
          {data && (
            <p className="text-muted-foreground text-xs">
              Draft created {supportDate(data.createdAt)}.
            </p>
          )}
        </>
      )}
      {draft.submissionUncertain && !ticketID && (
        <div className="space-y-2 text-sm">
          <p role="alert">
            The previous submission could not be confirmed. Check or retry with
            this draft before starting another ticket.
          </p>
          <p>
            Submission reference: <code>{draft.identity?.id}</code>
          </p>
          {!draft.query.isError && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || draft.busy || draft.query.isFetching}
              onClick={() => {
                void draft.query.refetch();
              }}
            >
              Check submission
            </Button>
          )}
        </div>
      )}
      <div className="space-y-2">
        <label htmlFor={inputID} className="font-medium text-sm">
          Attach files
        </label>
        <Input
          id={inputID}
          type="file"
          multiple
          disabled={unavailable}
          onChange={(event) => {
            const input = event.currentTarget;
            draft.addFiles(Array.from(input.files ?? []));
            input.value = '';
          }}
        />
      </div>
      {queue.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {queue.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0 break-words">
                <p>{item.file.name}</p>
                <p className="text-muted-foreground text-xs">
                  {item.error ??
                    (item.status === 'uploading'
                      ? 'Uploading…'
                      : 'Ready to upload')}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${item.file.name}`}
                disabled={unavailable}
                onClick={() => {
                  void perform(
                    { type: 'remove', id: item.id },
                    'Removing file…',
                    'File removed',
                  );
                }}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {queue.some(
        (item) => item.status === 'pending' || item.status === 'failed',
      ) && (
        <ButtonWithLoading
          type="button"
          variant="outline"
          loading={draft.busy}
          disabled={unavailable}
          onClick={() => {
            void perform(
              { type: 'upload' },
              'Uploading draft attachments…',
              'Files uploaded',
            );
          }}
        >
          Upload files
        </ButtonWithLoading>
      )}
      {draft.hasFiles && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-muted-foreground text-xs">
            Discard draft attachments to change organization. Ticket text is
            kept.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              disabled || draft.busy || !!ticketID || draft.submissionUncertain
            }
            onClick={() => {
              void perform(
                { type: 'clear' },
                'Discarding draft attachments…',
                'Draft attachments discarded',
              );
            }}
          >
            Discard draft attachments
          </Button>
        </div>
      )}
    </section>
  );
}
