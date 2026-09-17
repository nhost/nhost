'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signInHref } from '@/app/signin/destination';
import { cn } from '@/lib/utils';

/**
 * Segmented control for the starter's two views.
 *
 * Plain links rather than buttons, so both views stay shareable, bookmarkable
 * and prefetched. Signed out, the protected view's link asks for sign-in on
 * the way: following it to a page that only redirects would change the URL
 * without the interception ever seeing the navigation, leaving the visitor on
 * `/signin` with no modal and the old page still under it.
 */
export function ViewToggle({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();

  const views = [
    { path: '/', href: '/', label: 'Home' },
    {
      path: '/protected',
      href: signedIn ? '/protected' : signInHref('/protected'),
      label: 'Protected',
    },
  ];

  return (
    <nav
      aria-label="Views"
      className="inline-flex w-fit shrink-0 items-center gap-1 rounded-lg border bg-muted/60 p-1"
    >
      {views.map((view) => {
        const isActive = pathname === view.path;

        return (
          <Link
            key={view.path}
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
