import type { DetailedHTMLProps, HTMLProps, PropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';

import { NavLink } from '@/components/common/NavLink';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { LocalAccountMenu } from '@/components/layout/LocalAccountMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { Logo } from '@/components/presentational/Logo';
import { Box } from '@/components/ui/v2/Box';
import { CommandPaletteTrigger } from '@/features/command-palette';
import { AnnouncementsTray } from '@/features/orgs/components/members/components/AnnouncementsTray';
import { NotificationsTray } from '@/features/orgs/components/members/components/NotificationsTray';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import BreadcrumbNav from './BreadcrumbNav';

export type HeaderProps = PropsWithoutRef<
  DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
> & {
  // True when the layout renders the pinned rail, which carries its own
  // palette trigger.
  pinnedRailVisible?: boolean;
};

export default function Header({
  className,
  pinnedRailVisible = false,
  ...props
}: HeaderProps) {
  const isPlatform = useIsPlatform();

  return (
    <Box
      component="header"
      className={twMerge(
        'relative z-40 flex w-full transform-gpu items-center gap-2 border-b px-4',
        className,
      )}
      sx={{ backgroundColor: 'background.paper' }}
      {...props}
    >
      <div className="mr-2 h-6 w-6 shrink-0">
        <Logo className="mx-auto h-6 w-6 cursor-pointer" />
      </div>

      <BreadcrumbNav />

      {!pinnedRailVisible && (
        <CommandPaletteTrigger
          variant="icon"
          className="ml-auto h-8 w-8 shrink-0"
        />
      )}

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

        {isPlatform ? <AccountMenu /> : <LocalAccountMenu />}
      </div>

      <MobileNav className="shrink-0 sm:hidden" />
    </Box>
  );
}
