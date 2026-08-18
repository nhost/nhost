import type { ComponentPropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';

import { AccountMenu } from '@/components/layout/AccountMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { Logo } from '@/components/presentational/Logo';
import { InboxPopover } from '@/features/orgs/components/members/components/InboxPopover';
import HeaderNavigation from './HeaderNavigation';

export type HeaderProps = ComponentPropsWithoutRef<'header'>;

export default function Header({ className, ...props }: HeaderProps) {
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

      <HeaderNavigation />

      <div className="ml-auto hidden shrink-0 grid-flow-col items-center gap-1 sm:grid">
        <InboxPopover />

        <AccountMenu />
      </div>

      <MobileNav className="shrink-0 sm:hidden" />
    </header>
  );
}
