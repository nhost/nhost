import { useQuery } from '@tanstack/react-query';
import { LifeBuoyIcon, PlusIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { SupportError } from '@/features/support/components/SupportArea';
import {
  TicketSeverity,
  TicketStatus,
} from '@/features/support/components/TicketBadges';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import {
  PAGE_SIZE,
  STATUSES,
  supportDate,
  supportLabel,
  type TicketSearch,
  ticketFilter,
  ticketSearchSchema,
} from '@/features/support/utils/tickets';
import {
  DashboardSupportTicketsDocument,
  type DashboardSupportTicketsQuery,
} from '@/generated/graphql';

export default function TicketList() {
  const router = useRouter();
  const { user, isAgent, queryKey, request } = useSupportSession();
  const search = ticketSearchSchema.parse(router.query);
  const [query, setQuery] = useState(search.q);
  const [organization, setOrganization] = useState(search.organization);
  useEffect(() => {
    setQuery(search.q);
    setOrganization(search.organization);
  }, [search.q, search.organization]);
  const tickets = useQuery({
    queryKey: [...queryKey, 'tickets', search],
    queryFn: ({ signal }) =>
      request<DashboardSupportTicketsQuery>(
        DashboardSupportTicketsDocument,
        {
          where: ticketFilter(search, user?.id ?? '', isAgent),
          offset: search.page * PAGE_SIZE,
        },
        signal,
      ),
    enabled: !!user && router.isReady,
    cacheTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  const rows = tickets.data?.supportTickets ?? [];
  function changeSearch(changes: Partial<TicketSearch>) {
    void router.replace(
      { pathname: '/support', query: { ...search, page: 0, ...changes } },
      undefined,
      { shallow: true },
    );
  }

  return (
    <div className="space-y-6 p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-muted-foreground text-sm">
            <LifeBuoyIcon className="size-4" />
            Nhost Support
            {isAgent && (
              <span className="rounded border px-2 py-0.5 text-xs">
                Agent workspace
              </span>
            )}
          </div>
          <h1 className="font-semibold text-2xl">Support tickets</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {isAgent
              ? 'Manage customer conversations across all organizations.'
              : 'Get help and follow conversations across your organizations.'}
          </p>
        </div>
        <Button asChild>
          <Link href="/support/ticket">
            <PlusIcon className="mr-2 size-4" />
            New ticket
          </Link>
        </Button>
      </header>
      {isAgent && (
        <nav className="flex flex-wrap gap-2" aria-label="Agent queues">
          <Button
            variant={search.queue === 'all' ? 'default' : 'outline'}
            onClick={() => changeSearch({ queue: 'all' })}
          >
            All tickets
          </Button>
          <Button
            variant={search.queue === 'mine' ? 'default' : 'outline'}
            onClick={() => changeSearch({ queue: 'mine' })}
          >
            Assigned to me
          </Button>
          <Button
            variant={search.queue === 'unassigned' ? 'default' : 'outline'}
            onClick={() => changeSearch({ queue: 'unassigned' })}
          >
            Unassigned
          </Button>
        </nav>
      )}
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 lg:flex-row">
        <form
          className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            changeSearch({ q: query, organization });
          }}
        >
          <Input
            aria-label="Search tickets"
            placeholder="Search ticket titles…"
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
            wrapperClassName="flex-1"
          />
          <Input
            aria-label="Filter by organization"
            placeholder="Organization name…"
            value={organization}
            maxLength={200}
            onChange={(event) => setOrganization(event.target.value)}
            wrapperClassName="flex-1"
          />
          <Button type="submit" variant="outline">
            <SearchIcon className="mr-2 size-4" />
            Search
          </Button>
        </form>
        <Select
          value={search.status}
          onValueChange={(status) =>
            changeSearch({
              status: ticketSearchSchema.shape.status.parse(status),
            })
          }
        >
          <SelectTrigger aria-label="Ticket status" className="lg:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active tickets</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {supportLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {tickets.isError ? (
        <SupportError
          message="Unable to load support tickets. Your access may have changed; please try again."
          retry={() => {
            void tickets.refetch();
          }}
        />
      ) : tickets.isLoading ? (
        <Spinner wrapperClassName="py-16">Loading tickets…</Spinner>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed px-5 py-16 text-center">
          <LifeBuoyIcon className="mx-auto mb-4 size-8 text-muted-foreground" />
          <h2 className="font-semibold">No tickets found</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Try different filters, or create a ticket to start a conversation.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Organization / Project</TableHead>
                {isAgent && <TableHead>Assignee</TableHead>}
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, PAGE_SIZE).map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="min-w-56 max-w-md">
                    <Link
                      href={`/support/tickets/${ticket.id}`}
                      className="block break-words font-medium hover:text-primary"
                    >
                      <span className="mr-2 font-mono text-muted-foreground text-xs">
                        #{ticket.number}
                      </span>{' '}
                      {ticket.title}
                    </Link>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {ticket.requesterName}
                    </p>
                  </TableCell>
                  <TableCell>
                    <TicketStatus status={ticket.status} />
                  </TableCell>
                  <TableCell>
                    <TicketSeverity severity={ticket.severity} />
                  </TableCell>
                  <TableCell>
                    <p>{ticket.organizationName}</p>
                    <p className="text-muted-foreground text-xs">
                      {ticket.projectName ?? 'Organization-wide'}
                    </p>
                  </TableCell>
                  {isAgent && (
                    <TableCell>{ticket.assigneeName ?? 'Unassigned'}</TableCell>
                  )}
                  <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                    {supportDate(ticket.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm">
          Page {search.page + 1} · Refreshes every 30 seconds
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={search.page === 0 || tickets.isFetching}
            onClick={() => changeSearch({ page: search.page - 1 })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={
              tickets.isError || rows.length <= PAGE_SIZE || tickets.isFetching
            }
            onClick={() => changeSearch({ page: search.page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Need a quick answer?{' '}
        <Link
          href="https://docs.nhost.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Read the docs
        </Link>{' '}
        or{' '}
        <Link
          href="https://discord.com/invite/9V7Qb2U"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          ask the community
        </Link>
        .
      </p>
    </div>
  );
}
