import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, UserMinus, UserPlus } from 'lucide-react';
import { useRouter } from 'next/router';
import { z } from 'zod';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/v3/alert-dialog';
import { Avatar } from '@/components/ui/v3/avatar';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  SupportBreadcrumb,
  SupportError,
} from '@/features/support/components/SupportArea';
import {
  TicketSeverity,
  TicketStatus,
} from '@/features/support/components/TicketBadges';
import TicketConversation from '@/features/support/components/TicketConversation';
import { useSupportSession } from '@/features/support/hooks/useSupportSession';
import { useSupportSubscription } from '@/features/support/hooks/useSupportSubscription';
import type { SupportTicketAttachment } from '@/features/support/hooks/useSupportTicketAttachments';
import { serviceIcon } from '@/features/support/utils/service-icons';
import {
  getAllowedSupportSeverities,
  SEVERITIES,
  supportDate,
  supportInitials,
  supportLabel,
} from '@/features/support/utils/tickets';
import {
  DashboardSupportTicketChangesDocument,
  type DashboardSupportTicketChangesSubscription,
  DashboardSupportTicketDocument,
  type DashboardSupportTicketQuery,
  DashboardUpdateSupportTicketDocument,
  type DashboardUpdateSupportTicketMutation,
  SupportTicketStatuses_Enum,
  type SupportTickets_Set_Input,
} from '@/generated/graphql';

function sameIds(a: { id: unknown }[], b: { id: unknown }[]) {
  const ids = new Set(a.map((item) => item.id));
  return a.length === b.length && b.every((item) => ids.has(item.id));
}

export default function TicketDetail() {
  const router = useRouter();
  const ticketId =
    typeof router.query.ticketId === 'string' ? router.query.ticketId : '';
  const validId = z.uuid().safeParse(ticketId).success;
  const { user, isAgent, role, queryKey, request } = useSupportSession();
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: [...queryKey, 'ticket', ticketId],
    queryFn: ({ signal }) =>
      request<DashboardSupportTicketQuery>(
        DashboardSupportTicketDocument,
        { id: ticketId },
        signal,
      ),
    enabled: !!user && router.isReady && validId,
    cacheTime: 0,
    retry: false,
  });
  const ticket = detail.data?.supportTicket;
  const allowedSeverities = getAllowedSupportSeverities(
    ticket?.organization?.plan?.supportAllowedSeverities,
  );
  async function invalidate() {
    await client.invalidateQueries({ queryKey: ['support', user?.id] });
  }
  useSupportSubscription<DashboardSupportTicketChangesSubscription>({
    document: DashboardSupportTicketChangesDocument,
    variables: { id: ticketId },
    enabled: !!user && router.isReady && validId,
    onData: ({ supportTicket: changed }) => {
      const loaded = client.getQueryData<DashboardSupportTicketQuery>([
        ...queryKey,
        'ticket',
        ticketId,
      ]);
      if (loaded && loaded.supportTicket?.updatedAt !== changed?.updatedAt) {
        for (const part of ['ticket', 'comments', 'events']) {
          void client.invalidateQueries({
            queryKey: [...queryKey, part, ticketId],
          });
        }
      }
      const listed = client.getQueryData<SupportTicketAttachment[]>([
        ...queryKey,
        'attachments',
        ticketId,
      ]);
      if (listed && !sameIds(listed, changed?.attachments ?? [])) {
        void client.invalidateQueries({
          queryKey: [...queryKey, 'attachments', ticketId],
        });
      }
    },
    onReconnect: () => {
      for (const part of ['ticket', 'comments', 'events', 'attachments']) {
        void client.invalidateQueries({
          queryKey: [...queryKey, part, ticketId],
        });
      }
    },
  });
  const update = useMutation({
    mutationFn: async (changes: SupportTickets_Set_Input) => {
      if (!isAgent) {
        throw new Error('Only support agents can update tickets.');
      }
      if (!ticket) {
        throw new Error('This ticket is no longer available.');
      }
      if (changes.severity && !allowedSeverities.includes(changes.severity)) {
        throw new Error(
          'This severity is not available on the organization’s current plan.',
        );
      }
      const result = await request<DashboardUpdateSupportTicketMutation>(
        DashboardUpdateSupportTicketDocument,
        { id: ticketId, version: ticket.version, changes },
      );
      if (result.updateSupportTickets?.affected_rows !== 1) {
        throw new Error(
          'This ticket changed or is no longer accessible. Review the latest version and try again.',
        );
      }
    },
    onSettled: invalidate,
  });
  const { isPending } = update;
  async function changeTicket(changes: SupportTickets_Set_Input) {
    await execPromiseWithErrorToast(() => update.mutateAsync(changes), {
      loadingMessage: 'Updating ticket…',
      successMessage: 'Ticket updated',
      errorMessage: 'Unable to update this ticket. Please try again.',
    });
  }
  if (router.isReady && !validId) {
    return (
      <div className="space-y-6 p-8">
        <SupportBreadcrumb currentPage="Ticket" />
        <SupportError message="Invalid ticket address." />
      </div>
    );
  }
  const loadError = detail.isError && (
    <div className="space-y-6 p-8">
      <SupportBreadcrumb currentPage="Ticket" />
      <SupportError
        message="Unable to load this ticket. Your access may have changed."
        retry={() => {
          void detail.refetch();
        }}
      />
    </div>
  );
  if (loadError && !ticket) {
    return loadError;
  }
  if (detail.isLoading || !router.isReady) {
    return (
      <div className="space-y-6 p-5 sm:p-8">
        <SupportBreadcrumb currentPage="Ticket" />
        <Spinner wrapperClassName="py-16">Loading ticket…</Spinner>
      </div>
    );
  }
  if (!ticket) {
    return (
      <div className="space-y-6 p-8">
        <SupportBreadcrumb currentPage="Ticket" />
        <h1 className="font-semibold text-xl">Ticket not found</h1>
        <p className="text-muted-foreground">
          This ticket does not exist, or you no longer have access to its
          organization.
        </p>
      </div>
    );
  }
  const closed = ticket.status === 'closed';
  const transitions =
    detail.data?.supportTicketTransitions.filter(
      (transition) => transition.fromStatus === ticket.status,
    ) ?? [];

  // A failed background refresh hides the ticket but keeps it mounted, so an
  // unsent reply survives until a retry succeeds.
  return (
    <>
      {loadError}
      <div key={`${user?.id}:${role}:${ticketId}`} hidden={!!loadError}>
        <header className="space-y-5 p-5 sm:p-8">
          <SupportBreadcrumb currentPage={ticket.title} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <h1 className="break-words font-semibold text-3xl">
                {ticket.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
                <span className="font-mono">#{ticket.number}</span>
                <TicketStatus status={ticket.status} isAgent={isAgent} />
                <span>
                  Opened by {ticket.requesterName} on{' '}
                  {supportDate(ticket.createdAt)}
                </span>
              </div>
            </div>
            {isAgent &&
              !closed &&
              transitions.some(
                (transition) => transition.toStatus === 'resolved',
              ) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={isPending}>
                      <Check aria-hidden="true" className="mr-2 size-4" />
                      Mark as resolved
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="flex w-full max-w-lg flex-col gap-6 p-6 text-left text-foreground sm:p-12">
                    <AlertDialogHeader className="gap-2">
                      <AlertDialogTitle className="text-xl">
                        Mark ticket #{ticket.number} as resolved?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {ticket.requesterName} will see it as resolved. If they
                        reply, it reopens.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6 gap-2 sm:space-x-0">
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          void changeTicket({
                            status: SupportTicketStatuses_Enum.Resolved,
                          });
                        }}
                      >
                        Mark as resolved
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
          </div>
        </header>
        <TicketConversation
          ticketId={ticketId}
          opening={{
            authorName: ticket.requesterName,
            createdAt: ticket.createdAt,
            body: ticket.description,
          }}
          closed={closed}
          invalidate={invalidate}
          disabled={isPending}
          sidebar={
            <>
              <section
                aria-label="Assignee"
                className="space-y-3 rounded-lg border p-4"
              >
                <h2 className="font-semibold text-sm">Assignee</h2>
                <div className="flex items-center justify-between gap-2">
                  {ticket.assigneeName ? (
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <Avatar
                        className="h-6 w-6 text-[0.625rem]"
                        fallback={supportInitials(ticket.assigneeName)}
                      />
                      <span className="truncate">
                        {ticket.assigneeName}
                        {ticket.assigneeID === user?.id && (
                          <span className="text-muted-foreground"> (you)</span>
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      Unassigned
                    </span>
                  )}
                  {isAgent && !closed && ticket.assigneeID && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="subtle"
                          aria-label="Unassign"
                          disabled={isPending}
                          onClick={() => {
                            void changeTicket({ assigneeID: null });
                          }}
                        >
                          <UserMinus aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Unassign</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {isAgent && !closed && ticket.assigneeID !== user?.id && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={isPending}
                    onClick={() => {
                      void changeTicket({ assigneeID: user?.id });
                    }}
                  >
                    <UserPlus aria-hidden="true" className="mr-2 size-4" />
                    Assign to me
                  </Button>
                )}
              </section>
              <section
                aria-label="Status and severity"
                className="space-y-4 rounded-lg border p-4"
              >
                <div className="space-y-2">
                  <h2 className="font-semibold text-sm">Status</h2>
                  {isAgent && !closed && transitions.length > 0 ? (
                    <Select
                      value={ticket.status}
                      disabled={isPending}
                      onValueChange={(value) => {
                        const transition = transitions.find(
                          (candidate) => candidate.toStatus === value,
                        );
                        if (transition) {
                          void changeTicket({ status: transition.toStatus });
                        }
                      }}
                    >
                      <SelectTrigger aria-label="Change ticket status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ticket.status}>
                          <TicketStatus status={ticket.status} isAgent />
                        </SelectItem>
                        {transitions.map((transition) => (
                          <SelectItem
                            key={transition.toStatus}
                            value={transition.toStatus}
                          >
                            {transition.toStatus === 'waiting_for_support' &&
                            ticket.status === 'resolved' ? (
                              'Reopen ticket'
                            ) : (
                              <TicketStatus
                                status={transition.toStatus}
                                isAgent
                              />
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <TicketStatus status={ticket.status} isAgent={isAgent} />
                  )}
                </div>
                <div className="space-y-2">
                  <h2 className="font-semibold text-sm">Severity</h2>
                  {isAgent && !closed ? (
                    <>
                      <Select
                        value={ticket.severity}
                        disabled={isPending}
                        onValueChange={(value) => {
                          const severity = allowedSeverities.find(
                            (candidate) => candidate === value,
                          );
                          if (severity && severity !== ticket.severity) {
                            void changeTicket({ severity });
                          }
                        }}
                      >
                        <SelectTrigger aria-label="Change ticket severity">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEVERITIES.map((severity) => (
                            <SelectItem
                              key={severity}
                              value={severity}
                              disabled={!allowedSeverities.includes(severity)}
                            >
                              <TicketSeverity severity={severity} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {allowedSeverities.length === 0 && (
                        <p className="text-muted-foreground text-xs">
                          This organization’s plan does not allow severity
                          changes.
                        </p>
                      )}
                    </>
                  ) : (
                    <TicketSeverity severity={ticket.severity} />
                  )}
                </div>
              </section>
              <section
                aria-label="Details"
                className="space-y-1 rounded-lg border p-4"
              >
                <h2 className="font-semibold text-sm">Details</h2>
                <dl className="divide-y text-sm">
                  {isAgent && (
                    <div className="flex justify-between gap-3 py-2.5">
                      <dt className="text-muted-foreground">Customer</dt>
                      <dd className="min-w-0 break-words text-right">
                        {ticket.requesterName}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground">Organization</dt>
                    <dd className="min-w-0 break-words text-right">
                      {ticket.organizationName}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground">Project</dt>
                    <dd className="min-w-0 break-words text-right">
                      {ticket.projectName ?? 'Organization-wide'}
                    </dd>
                  </div>
                  {isAgent && (
                    <div className="flex justify-between gap-3 py-2.5">
                      <dt className="text-muted-foreground">Opened</dt>
                      <dd className="text-right">
                        {supportDate(ticket.createdAt)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground">Last update</dt>
                    <dd className="text-right">
                      {supportDate(ticket.updatedAt)}
                    </dd>
                  </div>
                  {ticket.services.length > 0 && (
                    <div className="space-y-2 pt-2.5">
                      <dt className="text-muted-foreground">Services</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {ticket.services.map((service) => {
                          const Icon = serviceIcon(service);
                          return (
                            <Badge
                              key={service}
                              variant="outline"
                              className="gap-1.5 font-medium"
                            >
                              <Icon aria-hidden className="size-3" />
                              {supportLabel(service)}
                            </Badge>
                          );
                        })}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            </>
          }
        />
      </div>
    </>
  );
}
