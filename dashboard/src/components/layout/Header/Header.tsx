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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMac =
    mounted &&
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';

  return (
    <Box
      component="header"
      className={twMerge(
        'relative z-40 grid w-full transform-gpu grid-flow-col items-center justify-between gap-2 border-b px-4',
        className,
      )}
      sx={{ backgroundColor: 'background.paper' }}
      {...props}
    >
      <div className="mr-2 h-6 w-6">
        <Logo className="mx-auto h-6 w-6 cursor-pointer" />
      </div>

      <BreadcrumbNav />

      <button
        type="button"
        aria-label="Open command palette"
        aria-keyshortcuts="Meta+K Control+K"
        className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground motion-safe:transition-colors sm:hidden"
        onClick={openCommandPalette}
      >
        <Search className="h-4 w-4" />
      </button>

      <div className="hidden grid-flow-col items-center gap-1 sm:grid">
        <button
          type="button"
          aria-label="Open command palette"
          aria-keyshortcuts="Meta+K Control+K"
          className="mr-1 inline-flex h-9 min-w-48 items-center gap-2 rounded-md border bg-background px-3 text-left text-sm hover:bg-accent motion-safe:transition-colors lg:min-w-56"
          onClick={openCommandPalette}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-muted-foreground">Search…</span>
          <CommandShortcut>{shortcutLabel}</CommandShortcut>
        </button>

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

      <MobileNav className="sm:hidden" />
    </Box>
  );
}
