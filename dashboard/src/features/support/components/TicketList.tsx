import { SiDiscord, SiGithub } from '@icons-pack/react-simple-icons';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpenIcon,
  ExternalLinkIcon,
  LifeBuoyIcon,
  ListFilter,
  Paperclip,
  PlusIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Pagination } from '@/components/common/Pagination';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { Spinner } from '@/components/ui/v3/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v3/tabs';
import { SupportError } from '@/features/support/components/SupportArea';
import {
  TicketSeverity,
  TicketStatus,
} from '@/features/support/components/TicketBadges';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import {
  PAGE_SIZE,
  SAMPLE_TICKET_PAGE_SIZE,
  STATUSES,
  type TicketSearch,
  ticketFilter,
  ticketSearchSchema,
} from '@/features/support/utils/tickets';
import {
  DashboardSupportTicketsDocument,
  type DashboardSupportTicketsQuery,
} from '@/generated/graphql';

type TicketListRow = DashboardSupportTicketsQuery['supportTickets'][number] & {
  sampleAttachmentCount?: number;
  sampleLastReply?: string;
};

export default function TicketList() {
  const router = useRouter();
  const { user, isAgent, isSample, queryKey, request } = useSupportSession();
  const pageSize = isSample ? SAMPLE_TICKET_PAGE_SIZE : PAGE_SIZE;
  const search = ticketSearchSchema.parse(router.query);
  const [query, setQuery] = useState(search.q);
  useEffect(() => {
    setQuery(search.q);
  }, [search.q]);
  const tickets = useQuery({
    queryKey: [...queryKey, 'tickets', search],
    queryFn: ({ signal }) =>
      request<{ supportTickets: TicketListRow[]; sampleTicketCount?: number }>(
        DashboardSupportTicketsDocument,
        {
          where: ticketFilter(search, user?.id ?? '', isAgent),
          offset: search.page * pageSize,
        },
        signal,
      ),
    enabled: !!user && router.isReady,
    cacheTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  const rows = tickets.data?.supportTickets ?? [];
  const sampleTicketCount = tickets.data?.sampleTicketCount ?? 0;
  const samplePageCount = Math.ceil(sampleTicketCount / pageSize);
  const emptyQueue =
    !tickets.isLoading &&
    !tickets.isError &&
    rows.length === 0 &&
    search.page === 0 &&
    !search.q &&
    !search.organization &&
    search.status === 'active' &&
    !search.statusFilters &&
    search.queue === 'all';
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
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-2xl">Support</h1>
            {isAgent && <Badge variant="outline">Agent</Badge>}
          </div>
          <p className="text-muted-foreground text-sm">
            {isAgent
              ? 'Every customer ticket across all organizations.'
              : 'Talk to the Nhost team about anything in your projects.'}
          </p>
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <Tabs
          value={search.status === 'finished' ? 'finished' : search.status === 'active' ? 'active' : 'all'}
          onValueChange={(status) => changeSearch({
            status: ticketSearchSchema.shape.status.parse(status),
            statusFilters: '',
          })}
        >
          <TabsList aria-label="Ticket queues">
            <TabsTrigger value="active">Open</TabsTrigger>
            <TabsTrigger value="finished">Closed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          {isAgent && (
            <Button
              variant={search.queue === 'mine' ? 'subtle' : 'outline'}
              aria-pressed={search.queue === 'mine'}
              onClick={() => changeSearch({ queue: search.queue === 'mine' ? 'all' : 'mine' })}
            >
              Assigned to me
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><ListFilter aria-hidden="true" className="mr-2 size-4" /> Status</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {STATUSES.filter((status) => {
                const finished = status === 'closed' || status === 'resolved';
                return search.status === 'finished' ? finished : search.status !== 'active' || !finished;
              }).map((status) => {
                const selected = (search.statusFilters ?? '').split(',').filter(Boolean);
                return (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selected.includes(status)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) => changeSearch({
                      statusFilters: (checked
                        ? [...selected, status]
                        : selected.filter((value) => value !== status)
                      ).join(','),
                    })}
                  >
                    <TicketStatus status={status} isAgent={isAgent} dot />
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <form onSubmit={(event) => {
            event.preventDefault();
            changeSearch({ q: query, organization: '' });
          }}>
            <Input
              aria-label="Search tickets"
              placeholder="Search tickets, projects or #id"
              value={query}
              maxLength={200}
              onChange={(event) => setQuery(event.target.value)}
              className="sm:w-72"
            />
          </form>
        </div>
      </div>
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
                changeSearch({ q: '', organization: '', status: 'active', statusFilters: '', queue: 'all' })
              }
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <ul className="divide-y">
          {rows.slice(0, pageSize).map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/support/tickets/${ticket.id}`}
                className="group grid gap-2 rounded-sm px-2 py-4 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-12 lg:items-center"
              >
                <div className={isAgent ? 'min-w-0 lg:col-span-5' : 'min-w-0 lg:col-span-7'}>
                  <p className="break-words font-medium group-hover:text-primary">
                    <span className="mr-2 font-mono text-muted-foreground text-xs">#{ticket.number}</span>
                    {ticket.title}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
                    {isAgent && <span>{ticket.requesterName} ·</span>}
                    <span>{ticket.organizationName} / {ticket.projectName ?? 'Organization-wide'}</span>
                    {ticket.sampleLastReply && <span>· {ticket.sampleLastReply} replied</span>}
                    {!!ticket.sampleAttachmentCount && (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip aria-hidden="true" className="size-3" />
                        {ticket.sampleAttachmentCount}<span className="sr-only"> attachments</span>
                      </span>
                    )}
                  </p>
                </div>
                <div className={isAgent ? 'flex flex-wrap items-center gap-3 lg:col-span-7 lg:grid lg:grid-cols-7' : 'flex flex-wrap items-center gap-3 lg:col-span-5 lg:grid lg:grid-cols-5'}>
                  <span className="lg:col-span-2"><TicketStatus status={ticket.status} isAgent={isAgent} dot /></span>
                  <span className="lg:col-span-2"><TicketSeverity severity={ticket.severity} /></span>
                  {isAgent && <span className="break-words text-muted-foreground text-sm lg:col-span-2">{ticket.assigneeName ?? 'Unassigned'}</span>}
                  <time dateTime={ticket.updatedAt} className="whitespace-nowrap text-muted-foreground text-xs lg:text-right">
                    {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(ticket.updatedAt))}
                  </time>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {isSample && !tickets.isError && samplePageCount > 1 && (
        <Pagination
          className="px-2 [&>nav]:order-last [&>nav]:ml-auto"
          totalNrOfPages={samplePageCount}
          currentPageNumber={search.page + 1}
          totalNrOfElements={sampleTicketCount}
          itemsLabel="tickets"
          elementsPerPage={pageSize}
          onPrevPageClick={() => changeSearch({ page: search.page - 1 })}
          onNextPageClick={() => changeSearch({ page: search.page + 1 })}
          onPageChange={(page) => changeSearch({ page: page - 1 })}
        />
      )}
      {!isSample &&
        !tickets.isLoading &&
        (search.page > 0 || rows.length > pageSize) && (
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
                tickets.isError || rows.length <= pageSize || tickets.isFetching
              }
              onClick={() => changeSearch({ page: search.page + 1 })}
            >
              Next
            </Button>
          </div>
        )}
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
    </div>
  );
}
