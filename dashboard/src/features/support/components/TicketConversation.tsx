import { zodResolver } from '@hookform/resolvers/zod';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form } from '@/components/form/Form';
import { FormTextarea } from '@/components/form/FormTextarea';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { SupportError } from '@/features/support/components/SupportArea';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
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
interface TicketConversationProps {
  ticketId: string;
  closed: boolean;
  invalidate: () => Promise<void>;
  disabled: boolean;
}

export default function TicketConversation({
  ticketId,
  closed,
  invalidate,
  disabled,
}: TicketConversationProps) {
  const { queryKey, request } = useSupportSession();
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
  const conversation =
    comments.data?.pages
      .flatMap((page) => page.supportComments.slice(0, PAGE_SIZE))
      .reverse() ?? [];

  return (
    <div className="space-y-5">
      {comments.isError ? (
        <SupportError
          message="Unable to load this conversation. Your access may have changed."
          retry={() => {
            void comments.refetch();
          }}
        />
      ) : comments.isLoading ? (
        <Spinner>Loading replies…</Spinner>
      ) : (
        <>
          {comments.hasNextPage && (
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
          {conversation.map((comment) => (
            <article key={comment.id} className="rounded-lg border p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <p className="font-semibold text-sm">
                  {comment.authorName}
                  <span className="ml-2 rounded bg-muted px-2 py-1 font-normal text-muted-foreground text-xs">
                    {comment.authorRole === 'support_agents'
                      ? 'Nhost Support'
                      : 'Customer'}
                  </span>
                </p>
                <time
                  dateTime={comment.createdAt}
                  className="text-muted-foreground"
                >
                  {supportDate(comment.createdAt)}
                </time>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">
                {comment.body}
              </p>
            </article>
          ))}
        </>
      )}
      {closed ? (
        <p className="rounded-md bg-muted p-4 text-muted-foreground text-sm">
          This ticket is closed and read-only. Create a new ticket if you need
          further help.
        </p>
      ) : (
        <FormProvider {...form}>
          <Form
            className="space-y-4 rounded-lg border p-5"
            onSubmit={async ({ body }: z.infer<typeof replySchema>) => {
              await execPromiseWithErrorToast(() => reply.mutateAsync(body), {
                loadingMessage: 'Sending reply…',
                successMessage: 'Reply sent',
                errorMessage: 'Unable to send your reply. Please try again.',
              });
            }}
          >
            <FormTextarea
              control={form.control}
              name="body"
              label="Your reply"
              placeholder="Write a reply…"
              className="min-h-32"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Visible to everyone in this conversation.
              </p>
              <ButtonWithLoading
                type="submit"
                loading={form.formState.isSubmitting}
                disabled={disabled || comments.isError}
              >
                Send reply
              </ButtonWithLoading>
            </div>
          </Form>
        </FormProvider>
      )}
    </div>
  );
}
