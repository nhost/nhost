import { ArrowRightIcon, ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface SupportHelpCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  external?: boolean;
  href: string;
}

export default function SupportHelpCard({
  icon,
  title,
  description,
  external = false,
  href,
}: SupportHelpCardProps) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="group flex min-h-48 flex-col rounded-xl border bg-muted/10 p-6 transition-colors hover:border-primary/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-start justify-between">
        <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {icon}
        </span>
        {external ? (
          <ExternalLinkIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
          />
        ) : (
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        )}
      </span>
      <span className="mt-5 font-semibold text-lg">{title}</span>
      <span className="mt-1 text-muted-foreground text-sm">{description}</span>
      {external && <span className="sr-only">(opens in a new tab)</span>}
    </Link>
  );
}
