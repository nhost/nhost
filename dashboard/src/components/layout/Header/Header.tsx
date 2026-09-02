import { Home } from 'lucide-react';
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
        'sticky top-0 z-30 flex h-14 w-full transform-gpu items-center gap-2 border-b border-header-border bg-header-bg px-4 backdrop-blur-xl backdrop-saturate-150',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={dashboardHref}
          aria-label="Dashboard"
          className="group relative grid h-6 w-6 shrink-0 place-items-center"
        >
          <Logo className="col-start-1 row-start-1 h-6 w-6 cursor-pointer transition-all duration-300 ease-out motion-safe:group-hover:scale-75 motion-safe:group-hover:-rotate-12 motion-safe:group-hover:opacity-0" />
          <Home
            aria-hidden="true"
            strokeWidth={2}
            className="col-start-1 row-start-1 h-5 w-5 rotate-12 scale-75 text-foreground opacity-0 transition-all duration-300 ease-out motion-safe:group-hover:rotate-0 motion-safe:group-hover:scale-100 motion-safe:group-hover:opacity-100"
          />
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
