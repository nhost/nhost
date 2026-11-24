import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { z } from 'zod';
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
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  SupportBreadcrumb,
  SupportError,
} from '@/features/support/components/SupportArea';
import TicketActivity from '@/features/support/components/TicketActivity';
import {
  TicketSeverity,
  TicketStatus,
} from '@/features/support/components/TicketBadges';
import TicketConversation from '@/features/support/components/TicketConversation';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import {
  getAllowedSupportSeverities,
  SEVERITIES,
  supportDate,
  supportLabel,
  ticketStatusLabel,
} from '@/features/support/utils/tickets';
import {
  DashboardSupportTicketDocument,
  type DashboardSupportTicketQuery,
  DashboardUpdateSupportTicketDocument,
  type DashboardUpdateSupportTicketMutation,
  SupportTicketStatuses_Enum,
  type SupportTickets_Set_Input,
} from '@/generated/graphql';

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
    refetchInterval: 30000,
  });
  const ticket = detail.data?.supportTicket;
  const allowedSeverities = getAllowedSupportSeverities(
    ticket?.organization?.plan?.supportAllowedSeverities,
  );
  async function invalidate() {
    await client.invalidateQueries({ queryKey: ['support', user?.id] });
  }
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
  const isPending = update.status === 'loading';
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
  if (detail.isError) {
    return (
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

  return (
    <div key={`${user?.id}:${role}:${ticketId}`}>
      <header className="space-y-5 p-5 sm:p-8">
        <Link href="/support" className="inline-flex items-center gap-2 rounded-sm text-muted-foreground text-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft aria-hidden="true" className="size-4" />
          All tickets
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <h1 className="break-words font-semibold text-3xl">{ticket.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
              <span className="font-mono">#{ticket.number}</span>
              <TicketStatus status={ticket.status} isAgent={isAgent} dot />
              <span>Opened by {ticket.requesterName} on {supportDate(ticket.createdAt)}</span>
            </div>
          </div>
          {isAgent && !closed && transitions.some((transition) => transition.toStatus === 'resolved') && (
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => { void changeTicket({ status: SupportTicketStatuses_Enum.Resolved }); }}
            >
              <Check aria-hidden="true" className="mr-2 size-4" />
              Mark as resolved
            </Button>
          )}
        </div>
      </header>
      <TicketConversation
        ticketId={ticketId}
        opening={{ authorName: ticket.requesterName, createdAt: ticket.createdAt, body: ticket.description }}
        closed={closed}
        invalidate={invalidate}
        disabled={isPending}
        sidebar={(
          <>
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
                    {ticketStatusLabel(ticket.status, true)}
                  </SelectItem>
                  {transitions.map((transition) => (
                    <SelectItem
                      key={transition.toStatus}
                      value={transition.toStatus}
                    >
                      {transition.toStatus === 'waiting_for_support' &&
                      ticket.status === 'resolved'
                        ? 'Reopen ticket'
                        : ticketStatusLabel(transition.toStatus, true)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <TicketStatus status={ticket.status} isAgent={isAgent} dot />
            )}
          </div>
          <div className="space-y-2">
            <h2 className="font-semibold text-sm">Assigned to</h2>
            <p className="text-muted-foreground text-sm">
              {ticket.assigneeName ?? 'Unassigned'}
            </p>
            {isAgent && !closed && (
              <div className="flex flex-wrap gap-2">
                {ticket.assigneeID !== user?.id && (
                  <Button
                    size="sm"
                    variant="link"
                    className="h-auto p-0"
                    disabled={isPending}
                    onClick={() => {
                      void changeTicket({ assigneeID: user?.id });
                    }}
                  >
                    Assign to me
                  </Button>
                )}
                {ticket.assigneeID && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      void changeTicket({ assigneeID: null });
                    }}
                  >
                    Unassign
                  </Button>
                )}
              </div>
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
                      {supportLabel(severity)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {allowedSeverities.length
                  ? 'Available severities are determined by the organization’s current plan.'
                  : 'This organization’s plan does not allow severity changes.'}
              </p>
              </>
            ) : <TicketSeverity severity={ticket.severity} />}
          </div>
          <dl className="space-y-4 text-sm">
            {isAgent && (
              <div>
                <dt className="text-muted-foreground">Customer</dt>
                <dd>{ticket.requesterName}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Organization</dt>
              <dd>{ticket.organizationName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Project</dt>
              <dd>{ticket.projectName ?? 'Organization-wide'}</dd>
            </div>
            {isAgent && (
              <div>
                <dt className="text-muted-foreground">Opened</dt>
                <dd>{supportDate(ticket.createdAt)}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Last update</dt>
              <dd>{supportDate(ticket.updatedAt)}</dd>
            </div>
            <div>
              <dt className="mb-2 text-muted-foreground">Services</dt>
              <dd className="flex flex-wrap gap-2">
                {ticket.services.map((service) => <Badge key={service} variant="outline">{supportLabel(service)}</Badge>)}
              </dd>
            </div>
          </dl>
          </>
        )}
        activity={isAgent ? <TicketActivity ticketId={ticketId} /> : undefined}
      />
    </div>
  );
}
