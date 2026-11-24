import { SiDiscord, SiGithub } from '@icons-pack/react-simple-icons';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpenIcon,
  ExternalLinkIcon,
  LifeBuoyIcon,
  ListFilter,
  MessageSquare,
  Paperclip,
  PlusIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Pagination } from '@/components/common/Pagination';
import { Avatar } from '@/components/ui/v3/avatar';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import {
  type InputSuggestion,
  InputWithSuggestions,
} from '@/components/ui/v3/input-with-suggestions';
import { Label } from '@/components/ui/v3/label';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
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
  supportInitials,
  type TicketSearch,
  ticketFilter,
  ticketSearchSchema,
} from '@/features/support/utils/tickets';
import {
  DashboardSupportTicketsDocument,
  type DashboardSupportTicketsQuery,
} from '@/generated/graphql';
import { cn } from '@/lib/utils';

const SUGGESTION_LIMIT = 8;

function ticketSuggestions(rows: TicketListRow[]): InputSuggestion[] {
  const tickets = rows.map((ticket) => ({
    label: ticket.title,
    value: `#${ticket.number}`,
  }));
  const places = [
    ...new Set(
      rows.flatMap((ticket) =>
        ticket.projectName
          ? [ticket.organizationName, ticket.projectName]
          : [ticket.organizationName],
      ),
    ),
  ].map((name) => ({ label: name, value: name }));
  return [...places, ...tickets].slice(0, SUGGESTION_LIMIT);
}

type TicketListRow = DashboardSupportTicketsQuery['supportTickets'][number] & {
  sampleAttachmentCount?: number;
};

export default function TicketList() {
  const router = useRouter();
  const { user, isAgent, isSample, queryKey, request } = useSupportSession();
  const pageSize = isSample ? SAMPLE_TICKET_PAGE_SIZE : PAGE_SIZE;
  const search = ticketSearchSchema.parse(router.query);
  const [query, setQuery] = useState(search.q);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  useEffect(() => {
    setQuery(search.q);
  }, [search.q]);
  useEffect(() => {
    const timeout = setTimeout(() => setSuggestionQuery(query.trim()), 200);
    return () => clearTimeout(timeout);
  }, [query]);
  const suggestions = useQuery({
    queryKey: [
      ...queryKey,
      'ticket-suggestions',
      search.status,
      suggestionQuery,
    ],
    queryFn: ({ signal }) =>
      request<{ supportTickets: TicketListRow[] }>(
        DashboardSupportTicketsDocument,
        {
          where: ticketFilter(
            { ...search, q: suggestionQuery, statusFilters: '', page: 0 },
            user?.id ?? '',
            isAgent,
          ),
          offset: 0,
          replyRole: isAgent ? 'user' : 'support',
        },
        signal,
      ),
    enabled: !!user && router.isReady && suggestionQuery.length >= 2,
    retry: false,
    keepPreviousData: true,
  });
  const suggestionRows =
    suggestionQuery.length >= 2 ? (suggestions.data?.supportTickets ?? []) : [];
  const tickets = useQuery({
    queryKey: [...queryKey, 'tickets', search],
    queryFn: ({ signal }) =>
      request<{ supportTickets: TicketListRow[]; sampleTicketCount?: number }>(
        DashboardSupportTicketsDocument,
        {
          where: ticketFilter(search, user?.id ?? '', isAgent),
          offset: search.page * pageSize,
          replyRole: isAgent ? 'user' : 'support',
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
          {!isAgent && (
            <p className="text-muted-foreground text-sm">
              Talk to the Nhost team about anything in your projects.
            </p>
          )}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={
            search.status === 'finished'
              ? 'finished'
              : search.status === 'active'
                ? 'active'
                : 'all'
          }
          onValueChange={(status) =>
            changeSearch({
              status: ticketSearchSchema.shape.status.parse(status),
              statusFilters: '',
            })
          }
        >
          <TabsList aria-label="Ticket queues">
            <TabsTrigger value="active">Open</TabsTrigger>
            <TabsTrigger value="finished">Closed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          {isAgent && (
            <div className="mr-2 flex items-center gap-2">
              <Checkbox
                id="support-assigned-to-me"
                checked={search.queue === 'mine'}
                onCheckedChange={(checked) =>
                  changeSearch({ queue: checked === true ? 'mine' : 'all' })
                }
              />
              <Label
                htmlFor="support-assigned-to-me"
                className="cursor-pointer whitespace-nowrap font-normal text-sm"
              >
                Assigned to me
              </Label>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <ListFilter aria-hidden="true" className="mr-2 size-4" /> Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {STATUSES.filter((status) => {
                const finished = status === 'closed' || status === 'resolved';
                return search.status === 'finished'
                  ? finished
                  : search.status !== 'active' || !finished;
              }).map((status) => {
                const selected = (search.statusFilters ?? '')
                  .split(',')
                  .filter(Boolean);
                return (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selected.includes(status)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) =>
                      changeSearch({
                        statusFilters: (checked
                          ? [...selected, status]
                          : selected.filter((value) => value !== status)
                        ).join(','),
                      })
                    }
                  >
                    <TicketStatus status={status} isAgent={isAgent} dot />
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              changeSearch({ q: query, organization: '' });
            }}
          >
            <InputWithSuggestions
              aria-label="Search tickets"
              placeholder="Search tickets, projects or #id"
              value={query}
              maxLength={200}
              onChange={setQuery}
              suggestions={ticketSuggestions(suggestionRows)}
              filterSuggestions={false}
              onSuggestionSelect={(value) => {
                const ticket = suggestionRows.find(
                  (row) => `#${row.number}` === value,
                );
                if (ticket) {
                  void router.push(`/support/tickets/${ticket.id}`);
                  return;
                }
                changeSearch({ q: value, organization: '' });
              }}
              containerClassName="sm:w-72"
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
                changeSearch({
                  q: '',
                  organization: '',
                  status: 'active',
                  statusFilters: '',
                  queue: 'all',
                })
              }
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-2 text-foreground">Ticket</TableHead>
              <TableHead className="text-foreground">Project</TableHead>
              <TableHead className="text-foreground">Status</TableHead>
              <TableHead className="text-foreground">Severity</TableHead>
              {isAgent && (
                <TableHead className="text-foreground">Assignee</TableHead>
              )}
              <TableHead className="text-right text-foreground">
                Updated
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, pageSize).map((ticket) => {
              const yourTurn = isAgent
                ? ticket.status === 'new' ||
                  ticket.status === 'waiting_for_support'
                : ticket.status === 'waiting_for_customer';
              const replies = ticket.comments_aggregate?.aggregate?.count ?? 0;
              const lastReply = ticket.lastReply?.[0]?.createdAt;
              const readAt = ticket.reads?.[0]?.readAt;
              const newReply =
                !!lastReply &&
                (!readAt || Date.parse(lastReply) > Date.parse(readAt));
              return (
                <TableRow
                  key={ticket.id}
                  className={cn(
                    'group cursor-pointer hover:bg-muted/20',
                    newReply &&
                      'bg-primary/5 shadow-[inset_2px_0_0_hsl(var(--primary))] hover:bg-primary/10',
                  )}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('a')) {
                      return;
                    }
                    void router.push(`/support/tickets/${ticket.id}`);
                  }}
                >
                  <TableCell className="max-w-md px-2 py-3">
                    <Link
                      href={`/support/tickets/${ticket.id}`}
                      className="break-words font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:text-primary"
                    >
                      {ticket.title}
                    </Link>
                    {newReply ? (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-primary/40 px-1.5 py-px align-middle font-medium text-[0.625rem] text-primary">
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-primary"
                        />
                        New reply
                      </span>
                    ) : (
                      yourTurn && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-primary/40 px-1.5 py-px align-middle text-[0.625rem] text-primary">
                          Needs reply
                        </span>
                      )
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
                      <span className="font-mono">#{ticket.number}</span>
                      {isAgent && <span>· {ticket.requesterName}</span>}
                      {replies > 0 && (
                        <span className="inline-flex items-center gap-1">
                          ·{' '}
                          <MessageSquare
                            aria-hidden="true"
                            className="size-3"
                          />
                          {replies}
                          <span className="sr-only">
                            {replies === 1 ? ' reply' : ' replies'}
                          </span>
                        </span>
                      )}
                      {!!ticket.sampleAttachmentCount && (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip aria-hidden="true" className="size-3" />
                          {ticket.sampleAttachmentCount}
                          <span className="sr-only"> attachments</span>
                        </span>
                      )}
                    </p>
                  </TableCell>
                  <TableCell className="py-3">
                    <p className="text-sm">
                      {ticket.projectName ?? 'Organization-wide'}
                    </p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {ticket.organizationName}
                    </p>
                  </TableCell>
                  <TableCell className="py-3">
                    <TicketStatus
                      status={ticket.status}
                      isAgent={isAgent}
                      dot
                    />
                  </TableCell>
                  <TableCell className="py-3">
                    <TicketSeverity severity={ticket.severity} />
                  </TableCell>
                  {isAgent && (
                    <TableCell className="py-3">
                      {ticket.assigneeName ? (
                        <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
                          <Avatar
                            className="h-6 w-6 text-[0.625rem]"
                            fallback={supportInitials(ticket.assigneeName)}
                          />
                          {ticket.assigneeName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap py-3 text-right text-muted-foreground text-xs">
                    <time dateTime={ticket.updatedAt}>
                      {new Intl.DateTimeFormat(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(ticket.updatedAt))}
                    </time>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
            <span className="mt-3 font-semibold text-sm">Report on GitHub</span>{' '}
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
