import type { ComponentPropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';

import { NavLink } from '@/components/common/NavLink';
import { AccountMenu } from '@/components/layout/AccountMenu';
import BreadcrumbNav from '@/components/layout/Header/BreadcrumbNav';
import { MobileNav } from '@/components/layout/MobileNav';
import { Logo } from '@/components/presentational/Logo';
import { AnnouncementsTray } from '@/features/orgs/components/members/components/AnnouncementsTray';
import { NotificationsTray } from '@/features/orgs/components/members/components/NotificationsTray';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

export type HeaderProps = ComponentPropsWithoutRef<'header'>;

export default function Header({ className, ...props }: HeaderProps) {
  const isPlatform = useIsPlatform();

  return (
    <header
      className={twMerge(
        'relative z-40 flex w-full transform-gpu items-center gap-2 border-b bg-paper px-4',
        className,
      )}
      {...props}
    >
      <div className="mr-2 h-6 w-6 shrink-0">
        <Logo className="mx-auto h-6 w-6 cursor-pointer" />
      </div>

      <BreadcrumbNav />

      <div className="ml-auto hidden shrink-0 grid-flow-col items-center gap-1 sm:grid">
        <NotificationsTray />

        <AnnouncementsTray />

        {isPlatform && (
          <NavLink
            underline="none"
            href="/support"
            className="mr-1 rounded-md px-2.5 py-1.5 text-foreground text-sm hover:bg-accent motion-safe:transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Support
          </NavLink>
        )}

        <NavLink
          underline="none"
          href="https://docs.nhost.io"
          className="mr-2 rounded-md px-2.5 py-1.5 text-foreground text-sm hover:bg-accent motion-safe:transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs
        </NavLink>

        <AccountMenu />
      </div>

      <MobileNav className="shrink-0 sm:hidden" />
    </header>
  );
}
