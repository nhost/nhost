import { zodResolver } from '@hookform/resolvers/zod';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form } from '@/components/form/Form';
import { Avatar } from '@/components/ui/v3/avatar';
import { Badge } from '@/components/ui/v3/badge';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { SupportError } from '@/features/support/components/SupportArea';
import SupportMarkdown from '@/features/support/components/SupportMarkdown';
import SupportMarkdownEditor from '@/features/support/components/SupportMarkdownEditor';
import TicketActivity from '@/features/support/components/TicketActivity';
import TicketAttachments from '@/features/support/components/TicketAttachments';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import { useSupportTicketAttachments } from '@/features/support/hooks/use-support-ticket-attachments';
import {
  PAGE_SIZE,
  supportDate,
  supportGap,
  supportInitials,
} from '@/features/support/utils/tickets';
import {
  DashboardReplyToSupportTicketDocument,
  type DashboardReplyToSupportTicketMutation,
  DashboardSupportCommentsDocument,
  type DashboardSupportCommentsQuery,
  DashboardSupportEventsDocument,
  type DashboardSupportEventsQuery,
} from '@/generated/graphql';
import { cn } from '@/lib/utils';

const replySchema = z.object({
  body: z.string().trim().min(1, 'Write a reply').max(50000),
});
interface TimelineMessage {
  authorName: string;
  createdAt: string;
  body: string;
  authorRole?: string;
}

interface TicketConversationProps {
  opening: TimelineMessage;
  sidebar: ReactNode;
  ticketId: string;
  closed: boolean;
  invalidate: () => Promise<void>;
  disabled: boolean;
}

export default function TicketConversation({
  ticketId,
  opening,
  sidebar,
  closed,
  invalidate,
  disabled,
}: TicketConversationProps) {
  const { user, isAgent, role, queryKey, request } = useSupportSession();
  const attachmentScope = useMemo(() => ({ ticketId }), [ticketId]);
  const [attachmentPanel, setAttachmentPanel] = useState<HTMLDivElement | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState('conversation');
  const events = useQuery({
    queryKey: [...queryKey, 'events', ticketId],
    queryFn: ({ signal }) =>
      request<DashboardSupportEventsQuery>(
        DashboardSupportEventsDocument,
        { id: ticketId },
        signal,
      ),
    enabled: !!user && isAgent,
    cacheTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  const activity =
    isAgent && !events.isError ? events.data?.supportTicketEvents : undefined;
  const hasActivity =
    activity?.some((event) => event.kind !== 'created') ?? false;
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
      <Tabs
        value={hasActivity ? activeTab : 'conversation'}
        onValueChange={setActiveTab}
        className="min-w-0"
      >
        {hasActivity && (
          <TabsList
            variant="underline"
            aria-label="Ticket view"
            className="mb-8"
          >
            <TabsTrigger variant="underline" value="conversation">
              Conversation
            </TabsTrigger>
            <TabsTrigger variant="underline" value="activity">
              Activity · {activity?.length}
            </TabsTrigger>
          </TabsList>
        )}
        <TabsContent
          value="conversation"
          forceMount
          className="mt-0 data-[state=inactive]:hidden"
        >
          <section aria-label="Conversation" className="min-w-0 space-y-6">
            <ol className="space-y-5">
              {[
                { ...opening, id: 'opening' },
                ...(comments.isError ? [] : conversation),
              ].map((message, index, messages) => {
                const teamReply = message.authorRole === 'support';
                const next = messages[index + 1];
                const showGap =
                  !!next && !(index === 0 && comments.hasNextPage);
                const nhostReplied =
                  !teamReply && next?.authorRole === 'support';
                return (
                  <li
                    key={message.id}
                    className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-6"
                  >
                    {!comments.isError &&
                      (index < conversation.length || !closed) && (
                        <div
                          aria-hidden="true"
                          className={cn(
                            'absolute top-9 bottom-0 left-[calc(1.125rem-0.5px)] border-l',
                            index < conversation.length ? '-mb-5' : '-mb-6',
                          )}
                        />
                      )}
                    {showGap && (
                      <div className="absolute top-9 -bottom-5 left-[1.125rem] flex -translate-x-1/2 items-center">
                        <span
                          className={cn(
                            'whitespace-nowrap rounded-full border bg-background px-1.5 py-px text-[0.625rem] text-muted-foreground',
                            nhostReplied && 'border-primary/40 text-primary',
                          )}
                        >
                          {supportGap(message.createdAt, next.createdAt)}
                          <span className="sr-only">
                            {' '}
                            until the next message
                          </span>
                        </span>
                      </div>
                    )}
                    <Avatar
                      className="h-9 w-9"
                      aria-hidden="true"
                      fallback={supportInitials(message.authorName)}
                      fallbackClassName={
                        teamReply
                          ? 'bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground'
                          : undefined
                      }
                    />
                    <article className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium text-sm">
                          {message.authorName}
                        </h2>
                        {teamReply && (
                          <Badge variant="outline" className="text-primary">
                            Nhost
                          </Badge>
                        )}
                        <time
                          dateTime={message.createdAt}
                          className="text-muted-foreground text-xs"
                        >
                          {supportDate(message.createdAt)}
                        </time>
                      </div>
                      <div
                        className={cn(
                          'rounded-lg p-4',
                          teamReply ? 'bg-primary/10' : 'bg-muted/60',
                        )}
                      >
                        <SupportMarkdown
                          attachmentScope={attachmentScope}
                          compactAttachments
                        >
                          {message.body}
                        </SupportMarkdown>
                      </div>
                      {index === 0 &&
                        comments.hasNextPage &&
                        !comments.isError && (
                          <Button
                            variant="outline"
                            disabled={comments.isFetchingNextPage}
                            onClick={() => {
                              void comments.fetchNextPage();
                            }}
                          >
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
                retry={() => {
                  void comments.refetch();
                }}
              />
            ) : comments.isLoading ? (
              <Spinner>Loading replies…</Spinner>
            ) : null}
            {closed ? (
              <p className="rounded-md bg-muted p-4 text-muted-foreground text-sm">
                This ticket is closed and read-only. Create a new ticket if you
                need further help.
              </p>
            ) : (
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-6">
                <Avatar
                  className="h-9 w-9"
                  aria-hidden="true"
                  fallback={supportInitials(user?.displayName || 'You')}
                  fallbackClassName={
                    role === 'support'
                      ? 'bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground'
                      : undefined
                  }
                />
                <FormProvider {...form}>
                  <Form
                    onSubmit={async ({ body }: z.infer<typeof replySchema>) => {
                      if (
                        disabled ||
                        comments.isError ||
                        attachments.uploading
                      ) {
                        return;
                      }
                      await execPromiseWithErrorToast(
                        () => reply.mutateAsync(body),
                        {
                          loadingMessage: 'Sending reply…',
                          successMessage: 'Reply sent',
                          errorMessage:
                            'Unable to send your reply. Please try again.',
                        },
                      );
                    }}
                  >
                    <SupportMarkdownEditor
                      control={form.control}
                      name="body"
                      label={
                        role === 'support' ? 'Reply to customer' : 'Your reply'
                      }
                      placeholder="Write a reply…"
                      disabled={
                        disabled ||
                        comments.isError ||
                        form.formState.isSubmitting
                      }
                      filesDisabled={attachments.unavailable}
                      attachmentScope={attachmentScope}
                      attachmentPickerInFooter
                      replySubmit={
                        <ButtonWithLoading
                          type="submit"
                          loading={form.formState.isSubmitting}
                          disabled={
                            !form.watch('body').trim() ||
                            disabled ||
                            comments.isError ||
                            attachments.uploading
                          }
                        >
                          <Send aria-hidden="true" className="mr-2 size-4" />
                          Send reply
                        </ButtonWithLoading>
                      }
                      onFilesDrop={(files, onUploaded) =>
                        attachments.uploadFiles(files, onUploaded)
                      }
                      attachments={(insert) =>
                        attachmentPanel &&
                        createPortal(
                          <TicketAttachments
                            controller={attachments}
                            scope={attachmentScope}
                            closed={false}
                            onInsert={insert}
                            compact
                          />,
                          attachmentPanel,
                        )
                      }
                    />
                  </Form>
                </FormProvider>
              </div>
            )}
          </section>
        </TabsContent>
        {hasActivity && activity && (
          <TabsContent value="activity" className="mt-0 min-w-0">
            <TicketActivity events={activity} />
          </TabsContent>
        )}
      </Tabs>
      <aside
        aria-label="Ticket details"
        className="min-w-0 space-y-5 border-t pt-5 lg:border-t-0 lg:pt-7"
      >
        {sidebar}
        {closed ? (
          <TicketAttachments
            controller={attachments}
            scope={attachmentScope}
            closed
            compact
          />
        ) : (
          <div ref={setAttachmentPanel} />
        )}
      </aside>
    </div>
  );
}
