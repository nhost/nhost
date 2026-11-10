import { ExternalLinkIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { HTMLAttributes } from 'react';
import { features } from '@/features/orgs/projects/overview/features';
import { frameworks } from '@/features/orgs/projects/overview/frameworks';
import type { CardProps } from '@/features/orgs/projects/overview/types/cards';
import { cn } from '@/lib/utils';

export type OverviewDocumentationProps = HTMLAttributes<HTMLElement>;

function LearnIcon({ item }: { item: CardProps }) {
  if (item.iconIsComponent === false && typeof item.icon === 'string') {
    if (typeof item.lightIcon === 'string') {
      return (
        <>
          <Image
            src={item.icon}
            alt=""
            width={18}
            height={18}
            className="dark:hidden"
          />
          <Image
            src={item.lightIcon}
            alt=""
            width={18}
            height={18}
            className="hidden dark:block"
          />
        </>
      );
    }

    return <Image src={item.icon} alt="" width={18} height={18} />;
  }

  return typeof item.icon === 'string' ? null : item.icon;
}

function LearnList({ title, items }: { title: string; items: CardProps[] }) {
  return (
    <div className="overflow-hidden rounded-lg border shadow-sm">
      <h3 className="border-b px-4 py-3 font-medium text-sm">{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.title} className="border-b last:border-b-0">
            <Link
              href={item.link ?? 'https://docs.nhost.io'}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background [&_svg]:h-[18px] [&_svg]:w-[18px]">
                <LearnIcon item={item} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium text-sm">
                  {item.title}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {item.description}
                </span>
              </span>
              <ExternalLinkIcon
                aria-hidden
                className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Two even lists (four quickstarts, four guides) instead of cards of two
 * different sizes. Rows match the other lists on the page.
 */
export default function OverviewDocumentation({
  className,
  ...props
}: OverviewDocumentationProps) {
  return (
    <section className={cn('flex flex-col gap-4', className)} {...props}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-lg">Learn</h2>
        <Link
          href="https://docs.nhost.io"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          All docs
          <ExternalLinkIcon className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <LearnList title="Quickstarts" items={frameworks} />
        <LearnList title="Guides" items={features} />
      </div>
    </section>
  );
}
