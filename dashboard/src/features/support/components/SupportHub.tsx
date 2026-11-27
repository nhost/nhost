import { SiDiscord, SiGithub } from '@icons-pack/react-simple-icons';
import { BookOpenIcon, MessageSquare } from 'lucide-react';
import SupportHelpCard from '@/features/support/components/SupportHelpCard';

export default function SupportHub() {
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
          href="/support/tickets"
          title="Contact support"
          description="Open a ticket and talk to the Nhost team."
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
