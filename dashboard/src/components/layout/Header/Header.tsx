import Link from 'next/link';
import { useRouter } from 'next/router';
import { type ComponentPropsWithoutRef, useEffect } from 'react';
import { twMerge } from 'tailwind-merge';

import { useMediaQuery } from '@/components/common/useMediaQuery';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { useUpgradePlanLink } from '@/components/layout/AccountMenu/useUpgradePlanLink';
import { DashboardNavigationSheet } from '@/components/layout/DashboardNavigation';
import { useCurrentRoute } from '@/components/layout/DashboardNavigation/useCurrentRoute';
import HeaderNavigationSheet from '@/components/layout/Header/HeaderNavigationSheet';
import MobileAccountMenu from '@/components/layout/Header/MobileAccountMenu';
import SupportPopover from '@/components/layout/Header/SupportPopover';
import { Logo } from '@/components/presentational/Logo';
import { Button } from '@/components/ui/v3/button';
import {
  CommandPalette,
  CommandPaletteIconTrigger,
  CommandPaletteTrigger,
  useCommandPalette,
} from '@/features/command-palette';
import { CreateOrgFormDialog } from '@/features/orgs/components/CreateOrgFormDialog';
import {
  setCreateOrgDialogOpen,
  useCreateOrgDialogOpen,
} from '@/features/orgs/components/CreateOrgFormDialog/createOrgDialogStore';
import {
  InboxPopover,
  InboxPopoverTrigger,
  useInbox,
} from '@/features/orgs/components/members/components/InboxPopover';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';
import HeaderNavigation from './HeaderNavigation';

export type HeaderProps = ComponentPropsWithoutRef<'header'>;

export default function Header({ className, ...props }: HeaderProps) {
  const router = useRouter();
  // Most users are on desktop, so render it until the viewport is known.
  const isDesktop = useMediaQuery('md', { initialValue: true });
  const hasRoomForSearchBox = useMediaQuery('lg', { initialValue: true });
  // Only organization pages have navigation to open; elsewhere the mobile
  // header keeps the logo, as on desktop.
  const { isOrgRoute } = useCurrentRoute();
  const showNavigationSheet = !isDesktop && isOrgRoute;
  const { isFreeOrganization, href: upgradeHref } = useUpgradePlanLink();
  // One owner for both layouts, so switching between them neither posts the
  // pending organization request again nor drops its result.
  const inbox = useInbox();
  const { openCommandPalette, paletteProps } = useCommandPalette();
  const createOrgDialogOpen = useCreateOrgDialogOpen();
  const currentOrgSlug = getSingleQueryParam(router.query.orgSlug);
  const dashboardHref = currentOrgSlug
    ? `/orgs/${currentOrgSlug}/projects`
    : '/';

  // The open state lives in a module, so it would otherwise outlive the header
  // and reopen the dialog the next time it mounts.
  useEffect(() => () => setCreateOrgDialogOpen(false), []);

  return (
    <header
      className={twMerge(
        'relative z-40 flex h-14 w-full transform-gpu items-center gap-2 border-b bg-paper px-4',
        className,
      )}
      {...props}
    >
      <div
        className={twMerge(
          'flex min-w-0 items-center gap-2',
          !isDesktop && 'flex-1',
        )}
      >
        {showNavigationSheet ? (
          <DashboardNavigationSheet />
        ) : (
          <Link
            href={dashboardHref}
            aria-label="Dashboard"
            className="h-6 w-6 shrink-0"
          >
            <Logo className="mx-auto h-6 w-6 cursor-pointer" />
          </Link>
        )}

        {isDesktop ? <HeaderNavigation /> : <HeaderNavigationSheet />}
      </div>

      {hasRoomForSearchBox && (
        <div className="flex min-w-0 flex-1 justify-center">
          <CommandPaletteTrigger
            className="w-full max-w-[28rem]"
            onOpen={openCommandPalette}
          />
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
        {!hasRoomForSearchBox && (
          <CommandPaletteIconTrigger onOpen={openCommandPalette} />
        )}

        {isDesktop ? (
          <>
            {isFreeOrganization && upgradeHref && (
              <Button
                onClick={() => router.push(upgradeHref)}
                size="xs"
                variant="outline"
              >
                Upgrade
              </Button>
            )}

            <InboxPopoverTrigger hasUnread={inbox.hasUnread} />
            <SupportPopover />
            <AccountMenu />
          </>
        ) : (
          <MobileAccountMenu hasUnreadInbox={inbox.hasUnread} />
        )}
      </div>

      {/* Outside the layout switch, so an open palette survives crossing `lg`
          and an open checkout survives crossing `md`. The inbox attaches to
          the bell or to the mobile account menu; the organization switcher of
          either layout opens the dialog. */}
      <CommandPalette {...paletteProps} />
      <InboxPopover inbox={inbox} />
      <CreateOrgFormDialog
        hideNewOrgButton
        isOpen={createOrgDialogOpen}
        onOpenStateChange={setCreateOrgDialogOpen}
      />
    </header>
  );
}
