import { Paperclip, X } from 'lucide-react';
import Link from 'next/link';
import {
  type MouseEventHandler,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { SupportError } from '@/features/support/components/SupportArea';
import type { RemoveSupportAttachmentTokens } from '@/features/support/components/SupportMarkdownEditor';
import type { SupportAttachmentDraftController } from '@/features/support/hooks/use-support-attachment-draft';
import type { SupportAttachmentUploaded } from '@/features/support/utils/attachments';
import { cn } from '@/lib/utils';

interface DraftAttachmentsProps {
  draft: SupportAttachmentDraftController;
  disabled: boolean;
  onRemoveTokens: RemoveSupportAttachmentTokens;
  focusAttach: VoidFunction;
  onRetriedUpload?: SupportAttachmentUploaded;
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
  onClick: MouseEventHandler<HTMLButtonElement>;
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
          data-draft-remove
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
  onRemoveTokens,
  focusAttach,
  onRetriedUpload,
}: DraftAttachmentsProps) {
  const list = useRef<HTMLUListElement>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const ticketID = draft.query.data?.ticketID;
  const unavailable =
    disabled ||
    draft.busy ||
    draft.query.isError ||
    !!ticketID ||
    draft.submissionUncertain;
  useLayoutEffect(() => {
    if (focusIndex === null || draft.busy) {
      return;
    }
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>(
      'button[data-draft-remove]:enabled',
    );
    if (buttons?.length) {
      buttons[Math.min(focusIndex, buttons.length - 1)].focus();
    } else {
      focusAttach();
    }
    setFocusIndex(null);
  }, [draft.busy, focusAttach, focusIndex]);

  async function perform(
    operation: Parameters<typeof draft.action.mutateAsync>[0],
    loadingMessage: string,
    successMessage: string,
    trigger?: HTMLButtonElement,
  ) {
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>(
      'button[data-draft-remove]',
    );
    const index = trigger && buttons ? Array.from(buttons).indexOf(trigger) : 0;
    const removedItem =
      operation.type === 'remove'
        ? draft.uploads.find((item) => item.id === operation.id)
        : undefined;
    const result = await execPromiseWithErrorToast(
      () => draft.action.mutateAsync(operation),
      {
        loadingMessage,
        successMessage,
        errorMessage: 'Unable to update draft attachments. Please try again.',
      },
    );
    if (result === null || operation.type === 'upload') {
      return;
    }
    if (operation.type === 'discard') {
      onRemoveTokens({ id: operation.id });
    } else if (removedItem) {
      onRemoveTokens({ id: removedItem.reservationID, file: removedItem.file });
    }
    setFocusIndex(Math.max(0, index));
  }
  const queue = draft.uploads.filter(
    (item) =>
      item.status === 'failed' ||
      item.status === 'invalid' ||
      (item.status === 'pending' && !draft.busy),
  );
  const unidentified = draft.unfinished.filter(
    (item) => !draft.uploads.some((local) => local.reservationID === item.id),
  );

  const showList =
    !draft.query.isError &&
    !ticketID &&
    !!(unidentified.length || queue.length);

  return (
    <section
      aria-label="Draft attachments"
      className={cn(
        'space-y-3 bg-background',
        !showList &&
          !(draft.identity && draft.query.isError) &&
          !draft.submissionUncertain &&
          !ticketID &&
          'sr-only',
      )}
    >
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
      <div aria-live="polite">
        {showList && (
          <ul ref={list} className="grid gap-2 sm:grid-cols-2">
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
                  onClick={(event) => {
                    void perform(
                      { type: 'discard', id: item.id },
                      'Discarding unfinished upload…',
                      'Unfinished upload discarded',
                      event.currentTarget,
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
                <Paperclip aria-hidden="true" className="size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{item.file.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.status === 'failed'
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
                        { type: 'upload', onUploaded: onRetriedUpload },
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
                  onClick={(event) => {
                    void perform(
                      { type: 'remove', id: item.id },
                      'Removing file…',
                      'File removed',
                      event.currentTarget,
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
