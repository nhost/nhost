import { zodResolver } from '@hookform/resolvers/zod';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form } from '@/components/form/Form';
import { Avatar } from '@/components/ui/v3/avatar';
import { Badge } from '@/components/ui/v3/badge';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { SupportError } from '@/features/support/components/SupportArea';
import SupportMarkdown from '@/features/support/components/SupportMarkdown';
import SupportMarkdownEditor from '@/features/support/components/SupportMarkdownEditor';
import TicketAttachments from '@/features/support/components/TicketAttachments';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import { useSupportTicketAttachments } from '@/features/support/hooks/use-support-ticket-attachments';
import { cn } from '@/lib/utils';
import { PAGE_SIZE, supportDate } from '@/features/support/utils/tickets';
import {
  DashboardReplyToSupportTicketDocument,
  type DashboardReplyToSupportTicketMutation,
  DashboardSupportCommentsDocument,
  type DashboardSupportCommentsQuery,
} from '@/generated/graphql';

const replySchema = z.object({
  body: z.string().trim().min(1, 'Write a reply').max(50000),
});
interface TimelineMessage {
  authorName: string;
  createdAt: string;
  body: string;
  authorRole?: string;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => [...part][0]).join('').toLocaleUpperCase();
}

interface TicketConversationProps {
  opening: TimelineMessage;
  sidebar: ReactNode;
  activity?: ReactNode;
  ticketId: string;
  closed: boolean;
  invalidate: () => Promise<void>;
  disabled: boolean;
}

export default function TicketConversation({
  ticketId,
  opening,
  sidebar,
  activity,
  closed,
  invalidate,
  disabled,
}: TicketConversationProps) {
  const { user, role, queryKey, request } = useSupportSession();
  const [attachmentPanel, setAttachmentPanel] = useState<HTMLDivElement | null>(null);
  const comments = useInfiniteQuery({
    queryKey: [...queryKey, 'comments', ticketId],
    queryFn: ({ pageParam = 0, signal }) =>
      request<DashboardSupportCommentsQuery>(
        DashboardSupportCommentsDocument,
        { id: ticketId, offset: pageParam },
        signal,
      ),
    getNextPageParam: (last, pages) =>
      last.supportComments.length > PAGE_SIZE
        ? pages.length * PAGE_SIZE
        : undefined,
    cacheTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  const form = useForm<z.infer<typeof replySchema>>({
    resolver: zodResolver(replySchema),
    defaultValues: { body: '' },
  });
  const reply = useMutation({
    mutationFn: async (body: string) => {
      const result = await request<DashboardReplyToSupportTicketMutation>(
        DashboardReplyToSupportTicketDocument,
        { ticketId, body },
      );
      if (!result.insertSupportComment) {
        throw new Error('Your reply was not sent. Please try again.');
      }
    },
    onSuccess: async () => {
      form.reset();
      await invalidate();
    },
  });
  const attachments = useSupportTicketAttachments(
    ticketId,
    closed,
    disabled || comments.isError || form.formState.isSubmitting,
  );
  const conversation =
    comments.data?.pages
      .flatMap((page) => page.supportComments.slice(0, PAGE_SIZE))
      .reverse() ?? [];

  return (
    <div className="grid gap-8 px-5 pb-5 sm:px-8 sm:pb-8 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
      <section aria-label="Conversation" className="min-w-0 space-y-6">
        <ol className="space-y-5">
          {[{ ...opening, id: 'opening' }, ...(comments.isError ? [] : conversation)].map((message, index) => {
            const teamReply = message.authorRole === 'support_agent';
            return (
              <li key={message.id} className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                {!comments.isError && index < conversation.length && (
                  <div aria-hidden="true" className="absolute top-9 bottom-0 left-4 -mb-5 border-l" />
                )}
                <Avatar
                  className="size-9"
                  aria-hidden="true"
                  fallback={initials(message.authorName)}
                  fallbackClassName={teamReply ? 'bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground' : undefined}
                />
                <article className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-sm">{message.authorName}</h2>
                    {teamReply && <Badge variant="outline" className="text-primary">Nhost</Badge>}
                    <time dateTime={message.createdAt} className="text-muted-foreground text-xs">
                      {supportDate(message.createdAt)}
                    </time>
                  </div>
                  <div className={cn('rounded-lg p-4', teamReply ? 'bg-primary/5' : 'bg-muted/10')}>
                    <SupportMarkdown attachmentScope={{ ticketId }}>{message.body}</SupportMarkdown>
                  </div>
                  {index === 0 && comments.hasNextPage && !comments.isError && (
                    <Button variant="outline" disabled={comments.isFetchingNextPage} onClick={() => { void comments.fetchNextPage(); }}>
                      Load earlier replies
                    </Button>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
        {comments.isError ? (
          <SupportError
            message="Unable to load this conversation. Your access may have changed."
            retry={() => { void comments.refetch(); }}
          />
        ) : comments.isLoading ? <Spinner>Loading replies…</Spinner> : null}
        {closed ? (
          <p className="rounded-md bg-muted p-4 text-muted-foreground text-sm">
            This ticket is closed and read-only. Create a new ticket if you need further help.
          </p>
        ) : (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
            <Avatar
              className="size-9"
              aria-hidden="true"
              fallback={initials(user?.displayName || 'You')}
              fallbackClassName={role === 'support_agent' ? 'bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground' : undefined}
            />
            <FormProvider {...form}>
              <Form onSubmit={async ({ body }: z.infer<typeof replySchema>) => {
                if (disabled || comments.isError || attachments.uploading) {
                  return;
                }
                await execPromiseWithErrorToast(() => reply.mutateAsync(body), {
                  loadingMessage: 'Sending reply…',
                  successMessage: 'Reply sent',
                  errorMessage: 'Unable to send your reply. Please try again.',
                });
              }}>
                <SupportMarkdownEditor
                  control={form.control}
                  name="body"
                  label={role === 'support_agent' ? 'Reply to customer' : 'Your reply'}
                  placeholder="Write a reply…"
                  disabled={disabled || comments.isError || form.formState.isSubmitting}
                  filesDisabled={attachments.unavailable}
                  attachmentScope={{ ticketId }}
                  attachmentPickerInFooter
                  replySubmit={
                    <ButtonWithLoading
                      type="submit"
                      loading={form.formState.isSubmitting}
                      disabled={!form.watch('body').trim() || disabled || comments.isError || attachments.uploading}
                    >
                      <Send aria-hidden="true" className="mr-2 size-4" />
                      Send reply
                    </ButtonWithLoading>
                  }
                  onFilesDrop={(files, onUploaded) => attachments.uploadFiles(files, onUploaded)}
                  attachments={(insert) => attachmentPanel && createPortal(
                    <TicketAttachments controller={attachments} closed={false} onInsert={insert} compact />,
                    attachmentPanel,
                  )}
                />
              </Form>
            </FormProvider>
          </div>
        )}
      </section>
      <aside aria-label="Ticket details" className="min-w-0 space-y-5 border-t pt-5 lg:border-t-0 lg:pt-0">
        {sidebar}
        {closed ? <TicketAttachments controller={attachments} closed compact /> : <div ref={setAttachmentPanel} />}
        {activity}
      </aside>
    </div>
  );
}
