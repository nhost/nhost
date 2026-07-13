import { Search } from 'lucide-react';
import {
  type DetailedHTMLProps,
  type HTMLProps,
  type PropsWithoutRef,
  useEffect,
  useState,
} from 'react';
import { twMerge } from 'tailwind-merge';

import { NavLink } from '@/components/common/NavLink';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { LocalAccountMenu } from '@/components/layout/LocalAccountMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { Logo } from '@/components/presentational/Logo';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v3/button';
import { CommandShortcut } from '@/components/ui/v3/command';
import { useCommandPaletteOpen } from '@/features/command-palette';
import { AnnouncementsTray } from '@/features/orgs/components/members/components/AnnouncementsTray';
import { NotificationsTray } from '@/features/orgs/components/members/components/NotificationsTray';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import BreadcrumbNav from './BreadcrumbNav';

export type HeaderProps = PropsWithoutRef<
  DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
>;

export default function Header({ className, ...props }: HeaderProps) {
  const isPlatform = useIsPlatform();
  const { openCommandPalette } = useCommandPaletteOpen();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPod|iPad/i.test(navigator.userAgent));
  }, []);

  const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';

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

      <Button
        variant="outline"
        size="icon"
        aria-label="Open command palette"
        aria-keyshortcuts="Meta+K Control+K"
        className="ml-auto h-8 w-8 shrink-0 text-muted-foreground lg:hidden"
        onClick={openCommandPalette}
      >
        <Search className="h-4 w-4" />
      </Button>

      <div className="ml-auto hidden shrink-0 grid-flow-col items-center gap-1 sm:grid">
        <Button
          variant="outline"
          aria-label="Open command palette"
          aria-keyshortcuts="Meta+K Control+K"
          className="mr-1 hidden h-8 min-w-56 justify-start gap-2 px-3 font-normal text-muted-foreground lg:inline-flex"
          onClick={openCommandPalette}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <CommandShortcut>{shortcutLabel}</CommandShortcut>
        </Button>

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
