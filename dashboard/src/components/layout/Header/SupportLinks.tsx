import {
  ActivityIcon,
  BookOpenIcon,
  ExternalLinkIcon,
  LifeBuoyIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PlatformOnly } from '@/features/orgs/projects/common/components/PlatformOnly';

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
      className="flex h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-neutral-600 dark:text-sidebar-foreground">
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      <ExternalLinkIcon className="size-4 shrink-0 text-neutral-600 dark:text-sidebar-foreground" />
    </Link>
  );
}

/** The Support, Docs and Status rows. The host provides the list container. */
export default function SupportLinks() {
  return (
    <>
      <PlatformOnly>
        <SupportLink href="/support" icon={<LifeBuoyIcon className="size-4" />}>
          Support
        </SupportLink>
      </PlatformOnly>
      <SupportLink href={DOCS_URL} icon={<BookOpenIcon className="size-4" />}>
        Docs
      </SupportLink>
      <PlatformOnly>
        <SupportLink
          href={STATUS_URL}
          icon={<ActivityIcon className="size-4" />}
        >
          Status
        </SupportLink>
      </PlatformOnly>
    </>
  );
}
