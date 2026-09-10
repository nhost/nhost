import { SiDiscord as DiscordIcon } from '@icons-pack/react-simple-icons';
import {
  ActivityIcon,
  BookOpenIcon,
  CircleHelpIcon,
  ExternalLinkIcon,
  LifeBuoyIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { dashboardNavItemIconClassName } from '@/components/layout/DashboardSidebar/DashboardSidebar';
import { IconButton } from '@/components/ui/v3/icon-button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { Separator } from '@/components/ui/v3/separator';
import { cn } from '@/lib/utils';

const DISCORD_URL = 'https://discord.com/invite/9V7Qb2U';
const DOCS_URL = 'https://docs.nhost.io';
const STATUS_URL = 'https://status.nhost.io';

interface SupportLinkProps {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}

function SupportLink({ href, icon, children }: SupportLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-9 items-center gap-3 rounded-md px-4 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span className={cn('flex size-5 shrink-0 items-center justify-center', dashboardNavItemIconClassName)}>
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      <ExternalLinkIcon className={cn('size-4 shrink-0', dashboardNavItemIconClassName)} />
    </Link>
  );
}

export default function SupportPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton icon={CircleHelpIcon} aria-label="Help and support" />
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-72 p-0">
        <div className="px-4 py-4">
          <h2 className="font-semibold text-sm">Help and support</h2>
          <p className="mt-1 text-muted-foreground text-xs">
            Resources to keep you shipping.
          </p>
        </div>

        <Separator />

        <div className="grid gap-1 px-2 py-3">
          <SupportLink
            href="/support"
            icon={<LifeBuoyIcon className="size-4" />}
          >
            Support
          </SupportLink>
          <SupportLink
            href={DOCS_URL}
            icon={<BookOpenIcon className="size-4" />}
          >
            Docs
          </SupportLink>
          <SupportLink
            href={STATUS_URL}
            icon={<ActivityIcon className="size-4" />}
          >
            Status
          </SupportLink>
        </div>

        <div className="px-3 pb-3">
          <Link
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-emboss btn-emboss-primary flex items-center gap-3 rounded-md px-3 py-4"
          >
            <DiscordIcon className="size-7 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-sm">
                Join us on Discord
              </span>
              <span className="block text-xs opacity-90">
                Our community answers questions in minutes.
              </span>
            </span>
            <ExternalLinkIcon className="size-4 shrink-0" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
