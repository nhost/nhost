import { Loader2, Paperclip, X } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { SupportError } from '@/features/support/components/SupportArea';
import SupportAttachmentPreview from '@/features/support/components/SupportAttachmentPreview';
import type { SupportAttachmentDraftController } from '@/features/support/hooks/use-support-attachment-draft';
import { cn } from '@/lib/utils';

interface DraftAttachmentsProps {
  draft: SupportAttachmentDraftController;
  disabled: boolean;
  organizationSelected: boolean;
  onFiles: (files: File[]) => Promise<void>;
}

function fileSize(size: number) {
  return size >= 1000000
    ? `${(size / 1000000).toFixed(1)} MB`
    : `${Math.max(1, Math.ceil(size / 1000))} KB`;
}

function RemoveFile({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean;
  label: string;
  onClick: VoidFunction;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          aria-label={label}
          onClick={onClick}
          className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Remove</TooltipContent>
    </Tooltip>
  );
}

export default function DraftAttachments({
  draft,
  disabled,
  organizationSelected,
  onFiles,
}: DraftAttachmentsProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejectedDrop, setRejectedDrop] = useState(false);
  const data = draft.query.data?.draft;
  const ticketID = draft.query.data?.ticketID;
  const unavailable =
    disabled ||
    draft.busy ||
    draft.query.isError ||
    !!ticketID ||
    draft.submissionUncertain;
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
      className="space-y-3 bg-background"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const transfer = event.dataTransfer;
        transfer.dropEffect = unavailable ? 'none' : 'copy';
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes('Files')) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setDragging(false);
        setRejectedDrop(!organizationSelected);
        if (!unavailable) {
          void onFiles(Array.from(event.dataTransfer.files));
        }
      }}
    >
      <button
        type="button"
        aria-disabled={unavailable || undefined}
        aria-label="Attach files"
        className={cn(
          'w-full rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          unavailable
            ? 'cursor-not-allowed'
            : 'cursor-pointer hover:border-primary hover:bg-muted/20',
          unavailable && !dragging && 'opacity-50',
          dragging &&
            !unavailable &&
            'border-primary border-solid bg-primary/5 text-primary hover:bg-primary/5',
          dragging && !organizationSelected && 'border-destructive',
        )}
        onClick={() => {
          if (!unavailable) {
            input.current?.click();
          }
        }}
      >
        <Paperclip aria-hidden="true" className="mx-auto mb-2 size-4" />
        {dragging && !organizationSelected ? (
          <span className="block">Pick an organization first</span>
        ) : dragging && !unavailable ? (
          <span className="block">Drop to attach</span>
        ) : !organizationSelected ? (
          <span className="block">Pick an organization to attach files</span>
        ) : (
          <span className="block">
            Drop files here or{' '}
            <span className="font-medium text-foreground underline underline-offset-4">
              browse
            </span>
          </span>
        )}
        <span className="mt-1 block text-xs">Up to 5 MB each</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        disabled={unavailable}
        aria-label="Choose attachments"
        onChange={(event) => {
          const target = event.currentTarget;
          const files = Array.from(target.files ?? []);
          target.value = '';
          if (files.length > 0 && !unavailable) {
            void onFiles(files);
          }
        }}
      />
      {draft.identity && draft.query.isError && (
        <SupportError
          message="Unable to load draft attachments. The draft may already have created a ticket, or your access may have changed. Retry to check before starting another ticket."
          retry={() => {
            void draft.query.refetch();
          }}
        />
      )}
      {ticketID && (
        <p className="text-sm">
          This draft already created a ticket.{' '}
          <Link href={`/support/tickets/${ticketID}`} className="underline">
            Open the created ticket
          </Link>
          .
        </p>
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
              variant="ghost"
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
      {draft.hasFiles && (
        <p className="text-sm">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
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
          </Button>{' '}
          to change organization. Ticket text is kept.
        </p>
      )}
      <div aria-live="polite">
        {!organizationSelected && (dragging || rejectedDrop) && (
          <p className="sr-only">Pick an organization first</p>
        )}
        {!draft.query.isError && !ticketID && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data?.attachments.map((item) => (
              <li
                key={item.id}
                className="flex min-w-0 items-center gap-3 rounded-md border p-3 text-sm"
              >
                <SupportAttachmentPreview file={item.file} requestRole="user" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    {item.file?.name ?? 'Attachment unavailable'}
                  </p>
                  {item.file?.size != null && (
                    <p className="text-muted-foreground text-xs">
                      {fileSize(item.file.size)}
                    </p>
                  )}
                </div>
                <RemoveFile
                  disabled={unavailable}
                  label={`Remove attachment ${item.file?.name ?? item.id}`}
                  onClick={() => {
                    void perform(
                      { type: 'discard', id: item.id },
                      'Removing attachment…',
                      'Attachment removed',
                    );
                  }}
                />
              </li>
            ))}
            {unidentified.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-md border p-3 text-sm"
              >
                <p className="min-w-0 flex-1 break-words">
                  Unfinished upload {item.id}. Remove it before submitting the
                  ticket.
                </p>
                <RemoveFile
                  disabled={unavailable}
                  label={`Discard unfinished upload ${item.id}`}
                  onClick={() => {
                    void perform(
                      { type: 'discard', id: item.id },
                      'Discarding unfinished upload…',
                      'Unfinished upload discarded',
                    );
                  }}
                />
              </li>
            ))}
            {queue.map((item) => (
              <li
                key={item.id}
                className={cn(
                  'flex min-w-0 items-center gap-3 rounded-md border p-3 text-sm',
                  item.status === 'failed' && 'border-destructive',
                )}
              >
                {item.status === 'uploading' ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-5 shrink-0 animate-spin"
                  />
                ) : (
                  <Paperclip aria-hidden="true" className="size-5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate">{item.file.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.status === 'uploading'
                      ? 'Uploading…'
                      : item.status === 'failed'
                        ? 'Upload failed'
                        : 'Ready to upload'}{' '}
                    · {fileSize(item.file.size)}
                  </p>
                  {item.error && (
                    <p className="text-destructive text-xs">{item.error}</p>
                  )}
                </div>
                {(item.status === 'failed' || item.status === 'pending') && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={unavailable}
                    onClick={() => {
                      void perform(
                        { type: 'upload' },
                        'Uploading draft attachments…',
                        'Files uploaded',
                      );
                    }}
                  >
                    Retry
                  </Button>
                )}
                <RemoveFile
                  disabled={unavailable}
                  label={`Remove ${item.file.name}`}
                  onClick={() => {
                    void perform(
                      { type: 'remove', id: item.id },
                      'Removing file…',
                      'File removed',
                    );
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
