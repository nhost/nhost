'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const views = [
  { href: '/', label: 'Home' },
  { href: '/protected', label: 'Protected' },
];

/**
 * Segmented control for the starter's two views.
 *
 * Plain links rather than buttons, so both views stay shareable, bookmarkable
 * and prefetched.
 */
export function ViewToggle() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Views"
      className="inline-flex w-fit items-center gap-1 rounded-lg border bg-muted/60 p-1"
    >
      {views.map((view) => {
        const isActive = pathname === view.href;

        return (
          <Link
            key={view.href}
            href={view.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 font-medium text-sm transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
