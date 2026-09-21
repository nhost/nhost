import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ComponentPropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';

import { useMediaQuery } from '@/components/common/useMediaQuery';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { useUpgradePlanLink } from '@/components/layout/AccountMenu/useUpgradePlanLink';
import { DashboardNavigationSheet } from '@/components/layout/DashboardNavigation';
import HeaderNavigationSheet from '@/components/layout/Header/HeaderNavigationSheet';
import MobileAccountMenu from '@/components/layout/Header/MobileAccountMenu';
import SupportPopover from '@/components/layout/Header/SupportPopover';
import { Logo } from '@/components/presentational/Logo';
import { Button } from '@/components/ui/v3/button';
import {
  CommandPaletteIconTrigger,
  CommandPaletteTrigger,
} from '@/features/command-palette';
import { InboxPopover } from '@/features/orgs/components/members/components/InboxPopover';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';
import HeaderNavigation from './HeaderNavigation';

export type HeaderProps = ComponentPropsWithoutRef<'header'>;

export default function Header({ className, ...props }: HeaderProps) {
  const router = useRouter();
  const isDesktop = useMediaQuery('md');
  const hasRoomForSearchBox = useMediaQuery('lg');
  const { isFreeOrganization, href: upgradeHref } = useUpgradePlanLink();
  const currentOrgSlug = getSingleQueryParam(router.query.orgSlug);
  const dashboardHref = currentOrgSlug
    ? `/orgs/${currentOrgSlug}/projects`
    : '/';

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
        {isDesktop ? (
          <Link
            href={dashboardHref}
            aria-label="Dashboard"
            className="h-6 w-6 shrink-0"
          >
            <Logo className="mx-auto h-6 w-6 cursor-pointer" />
          </Link>
        ) : (
          <DashboardNavigationSheet />
        )}

        {isDesktop ? <HeaderNavigation /> : <HeaderNavigationSheet />}
      </div>

      {hasRoomForSearchBox && (
        <div className="flex min-w-0 flex-1 justify-center">
          <CommandPaletteTrigger className="w-full max-w-[28rem]" />
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
        {!hasRoomForSearchBox && <CommandPaletteIconTrigger />}

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

            <InboxPopover />
            <SupportPopover />
            <AccountMenu />
          </>
        ) : (
          <MobileAccountMenu />
        )}
      </div>
    </header>
  );
}
