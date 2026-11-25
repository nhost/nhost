import { SiDiscord, SiGithub } from '@icons-pack/react-simple-icons';
import { useQuery } from '@tanstack/react-query';
import { BookOpenIcon, MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/v3/skeleton';
import SupportHelpCard from '@/features/support/components/SupportHelpCard';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import { PAGE_SIZE, readSeenTickets } from '@/features/support/utils/tickets';
import { DashboardSupportTicketsDocument, type DashboardSupportTicketsQuery } from '@/generated/graphql';

export default function SupportHub() {
  const { user, queryKey, request } = useSupportSession();
  const summary = useQuery({
    queryKey: [...queryKey, 'hub-summary'],
    enabled: !!user,
    cacheTime: 0,
    retry: false,
    refetchInterval: 30000,
    queryFn: async ({ signal }) => {
      const seen = readSeenTickets(user?.id ?? '');
      const ids = new Set<string>();
      let open = 0;
      let replies = 0;
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { supportTickets } = await request<DashboardSupportTicketsQuery>(
          DashboardSupportTicketsDocument,
          { where: {}, offset, replyRole: 'support' },
          signal,
          'user',
        );
        for (const ticket of supportTickets.slice(0, PAGE_SIZE)) {
          if (ids.has(ticket.id)) continue;
          ids.add(ticket.id);
          if (ticket.status !== 'resolved' && ticket.status !== 'closed') open++;
          const reply = ticket.lastReply?.[0]?.createdAt;
          if (reply && (!seen[ticket.id] || Date.parse(reply) > Date.parse(seen[ticket.id]))) replies++;
        }
        if (supportTickets.length <= PAGE_SIZE) break;
      }
      return { hasTickets: ids.size > 0, open, replies };
    },
  });
  let ticketFooter = <Skeleton className="h-4 w-28" />;
  if (summary.isError) {
    ticketFooter = <span className="text-muted-foreground text-xs">Open your tickets</span>;
  } else if (summary.isSuccess) {
    const { open, replies } = summary.data;
    ticketFooter = (
      <span className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">
          {open === 0 ? 'No open tickets' : `${open} open ${open === 1 ? 'ticket' : 'tickets'}`}
        </span>
        {replies > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-1.5 py-px font-medium text-[0.625rem] text-primary">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            {replies === 1 ? '1 new reply' : `${replies} new replies`}
          </span>
        )}
      </span>
    );
  }
  return (
    <div className="px-5 py-12 sm:px-8 sm:py-20">
      <header className="mx-auto mb-10 flex max-w-2xl flex-col items-center text-center">
        <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">
          How can we help?
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Ask our team, search the docs or talk to other developers.
        </p>
      </header>
      <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
        <SupportHelpCard
          icon={<BookOpenIcon aria-hidden="true" className="size-6" />}
          href="https://docs.nhost.io"
          title="Read the docs"
          description="Guides and answers for every Nhost feature."
          external
        />
        <SupportHelpCard
          icon={<SiDiscord aria-hidden="true" className="size-6" />}
          href="https://discord.com/invite/9V7Qb2U"
          title="Ask the community"
          description="Get help from other developers on Discord."
          external
        />
        <SupportHelpCard
          icon={<MessageSquare aria-hidden="true" className="size-6" />}
          href={summary.isSuccess && !summary.data.hasTickets ? '/support/ticket' : '/support/tickets'}
          title="Contact support"
          description="Open a ticket and talk to the Nhost team."
          footer={ticketFooter}
        />
        <SupportHelpCard
          icon={<SiGithub aria-hidden="true" className="size-6" />}
          href="https://github.com/nhost/nhost/issues/new/choose"
          title="Report on GitHub"
          description="Found a bug or want a feature? Open an issue."
          external
        />
      </div>
    </div>
  );
}
