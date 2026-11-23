import { SiDiscord, SiGithub } from '@icons-pack/react-simple-icons';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpenIcon,
  ExternalLinkIcon,
  LifeBuoyIcon,
  PlusIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/v3/badge';
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
  const emptyQueue =
    !tickets.isLoading &&
    !tickets.isError &&
    rows.length === 0 &&
    search.page === 0 &&
    !search.q &&
    !search.organization &&
    search.status === 'active';
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
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-2xl">Support</h1>
          {isAgent && <Badge variant="outline">Agent</Badge>}
        </div>
        {(isAgent || (!tickets.isLoading && !emptyQueue)) && (
          <Button asChild>
            <Link href="/support/ticket">
              <PlusIcon className="mr-2 size-4" />
              Create ticket
            </Link>
          </Button>
        )}
      </header>
      {isAgent && !tickets.isLoading && (
        <nav className="flex flex-wrap gap-2" aria-label="Agent queues">
          <Button
            variant={search.queue === 'all' ? 'subtle' : 'ghost'}
            onClick={() => changeSearch({ queue: 'all' })}
          >
            All tickets
          </Button>
          <Button
            variant={search.queue === 'mine' ? 'subtle' : 'ghost'}
            onClick={() => changeSearch({ queue: 'mine' })}
          >
            Assigned to me
          </Button>
          <Button
            variant={search.queue === 'unassigned' ? 'subtle' : 'ghost'}
            onClick={() => changeSearch({ queue: 'unassigned' })}
          >
            Unassigned
          </Button>
        </nav>
      )}
      {!tickets.isLoading && !emptyQueue && (
        <div className="flex flex-col gap-3 sm:flex-row">
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
            {isAgent && (
              <Input
                aria-label="Filter by organization"
                placeholder="Organization name…"
                value={organization}
                maxLength={200}
                onChange={(event) => setOrganization(event.target.value)}
                wrapperClassName="flex-1"
              />
            )}
            <button type="submit" hidden>
              Search
            </button>
          </form>
          <Select
            value={search.status}
            onValueChange={(status) =>
              changeSearch({
                status: ticketSearchSchema.shape.status.parse(status),
              })
            }
          >
            <SelectTrigger
              aria-label="Ticket status"
              className="w-full sm:w-48"
            >
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
      )}
      {tickets.isError ? (
        <SupportError
          message="Unable to load support tickets. Your access may have changed; please try again."
          retry={() => {
            void tickets.refetch();
          }}
        />
      ) : tickets.isLoading ? (
        <div className="flex min-h-80 w-full flex-col items-center justify-center rounded-lg border px-6 py-20 text-center sm:min-h-112 sm:px-8 sm:py-32">
          <Spinner>Loading tickets…</Spinner>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-80 w-full flex-col items-center justify-center rounded-lg border px-6 py-20 text-center sm:min-h-112 sm:px-8 sm:py-32">
          <div className="rounded-full bg-muted p-3">
            <LifeBuoyIcon
              aria-hidden="true"
              className="size-6 text-muted-foreground"
            />
          </div>
          <h2 className="mt-4 font-semibold">
            {emptyQueue
              ? isAgent
                ? 'No tickets in this queue'
                : 'No tickets yet'
              : 'No tickets match'}
          </h2>
          {emptyQueue ? (
            !isAgent && (
              <>
                <p className="mt-1 max-w-sm text-muted-foreground text-sm">
                  Need help? Create a ticket and we'll reply here.
                </p>
                <Button asChild className="mt-6">
                  <Link href="/support/ticket">
                    <PlusIcon className="mr-2 size-4" />
                    Create ticket
                  </Link>
                </Button>
              </>
            )
          ) : (
            <Button
              variant="ghost"
              className="mt-6"
              onClick={() =>
                changeSearch({ q: '', organization: '', status: 'active' })
              }
            >
              Clear filters
            </Button>
          )}
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
                <TableRow key={ticket.id} className="hover:bg-muted/20">
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
      {!tickets.isLoading && (search.page > 0 || rows.length > PAGE_SIZE) && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={search.page === 0 || tickets.isFetching}
            onClick={() => changeSearch({ page: search.page - 1 })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={
              tickets.isError || rows.length <= PAGE_SIZE || tickets.isFetching
            }
            onClick={() => changeSearch({ page: search.page + 1 })}
          >
            Next
          </Button>
        </div>
      )}
      {!isAgent && (
        <section aria-labelledby="support-help-heading">
          <h2 id="support-help-heading" className="sr-only">
            Other ways to get help
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Link
              href="https://docs.nhost.io"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-1 rounded-lg border bg-muted/10 p-4 transition-colors hover:border-primary/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center justify-between">
                <BookOpenIcon
                  aria-hidden="true"
                  className="size-5 text-muted-foreground"
                />
                <ExternalLinkIcon
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
                />
              </span>
              <span className="mt-3 font-semibold text-sm">Read the docs</span>{' '}
              <span className="text-muted-foreground text-sm">
                Guides and answers for every Nhost feature.
              </span>{' '}
              <span className="sr-only">(opens in a new tab)</span>
            </Link>
            <Link
              href="https://github.com/nhost/nhost/issues/new/choose"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-1 rounded-lg border bg-muted/10 p-4 transition-colors hover:border-primary/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center justify-between">
                <SiGithub
                  aria-hidden="true"
                  className="size-5 text-muted-foreground"
                />
                <ExternalLinkIcon
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
                />
              </span>
              <span className="mt-3 font-semibold text-sm">
                Report on GitHub
              </span>{' '}
              <span className="text-muted-foreground text-sm">
                Found a bug or want a feature? Open an issue.
              </span>{' '}
              <span className="sr-only">(opens in a new tab)</span>
            </Link>
            <Link
              href="https://discord.com/invite/9V7Qb2U"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-1 rounded-lg border bg-muted/10 p-4 transition-colors hover:border-primary/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center justify-between">
                <SiDiscord
                  aria-hidden="true"
                  className="size-5 text-muted-foreground"
                />
                <ExternalLinkIcon
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
                />
              </span>
              <span className="mt-3 font-semibold text-sm">
                Ask the community
              </span>{' '}
              <span className="text-muted-foreground text-sm">
                Get help from other developers on Discord.
              </span>{' '}
              <span className="sr-only">(opens in a new tab)</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
