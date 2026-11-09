import { ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import type { HTMLAttributes } from 'react';
import { OverviewCard } from '@/features/orgs/projects/overview/components/OverviewCard';
import { features } from '@/features/orgs/projects/overview/features';
import { frameworks } from '@/features/orgs/projects/overview/frameworks';
import { cn } from '@/lib/utils';

export type OverviewDocumentationProps = HTMLAttributes<HTMLElement>;

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
          className="inline-flex items-center gap-1 font-medium text-primary text-sm hover:underline"
        >
          All docs
          <ExternalLinkIcon className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {frameworks.map((cardElement) => (
          <OverviewCard key={cardElement.title} {...cardElement} />
        ))}
      </div>

      <div className="grid xs:grid-cols-2 gap-3 xl:grid-cols-4">
        {features.map((cardElement) => (
          <OverviewCard key={cardElement.title} {...cardElement} />
        ))}
      </div>
    </section>
  );
}
