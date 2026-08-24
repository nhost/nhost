import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ComponentPropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';

import { useMediaQuery } from '@/components/common/useMediaQuery';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { Logo } from '@/components/presentational/Logo';
import { Button } from '@/components/ui/v3/button';
import { CommandPaletteTrigger } from '@/features/command-palette';
import { InboxPopover } from '@/features/orgs/components/members/components/InboxPopover';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';
import HeaderNavigation from './HeaderNavigation';

export type HeaderProps = ComponentPropsWithoutRef<'header'>;

export default function Header({ className, ...props }: HeaderProps) {
  const router = useRouter();
  const isDesktop = useMediaQuery('md');
  const { org } = useCurrentOrg();
  const currentOrgSlug = getSingleQueryParam(router.query.orgSlug);
  const dashboardHref = currentOrgSlug
    ? `/orgs/${currentOrgSlug}/projects`
    : '/';
  const isFreeOrg = org?.plan?.isFree;

  function handleUpgradeClick() {
    if (!org?.slug) {
      return;
    }

    router.push(`/orgs/${org.slug}/billing?openUpgradeModal=true`);
  }

  return (
    <header
      className={twMerge(
        'relative z-40 flex h-14 w-full transform-gpu items-center gap-2 border-b bg-paper px-4',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={dashboardHref}
          aria-label="Dashboard"
          className="h-6 w-6 shrink-0"
        >
          <Logo className="mx-auto h-6 w-6 cursor-pointer" />
        </Link>

        <HeaderNavigation />
      </div>

      {isDesktop && (
        <div className="flex flex-1 justify-center">
          <CommandPaletteTrigger className="w-[28rem]" />
        </div>
      )}

      <div className="ml-auto flex min-w-0 shrink-0 justify-end">
        <div className="hidden items-center gap-2 sm:flex">
          {isFreeOrg && (
            <Button onClick={handleUpgradeClick} size="xs" variant="outline">
              Upgrade
            </Button>
          )}

          <InboxPopover />

          <AccountMenu />
        </div>

        <MobileNav className="shrink-0 sm:hidden" />
      </div>
    </header>
  );
}
