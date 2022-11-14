import Breadcrumbs from '@/components/common/Breadcrumbs';
import FeedbackForm from '@/components/common/FeedbackForm';
import { Logo } from '@/components/common/Logo';
import MobileNav from '@/components/common/MobileNav';
import NavLink from '@/components/common/NavLink';
import { AccountMenu } from '@/components/dashboard/AccountMenu';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import { Dropdown } from '@/ui/v2/Dropdown';
import { useRouter } from 'next/router';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface HeaderProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {}

export default function Header({ className, ...props }: HeaderProps) {
  const router = useRouter();
  const isPlatform = useIsPlatform();

  return (
    <header
      className={twMerge(
        'z-40 grid w-full transform-gpu grid-flow-col items-center justify-between gap-2 border-b-1 border-gray-200 bg-white px-4 py-3 text-greyscaleDark',
        className,
      )}
      {...props}
    >
      <div className="grid grid-flow-col items-center gap-3">
        <NavLink href="/" className="w-12">
          <Logo className="mx-auto" />
        </NavLink>

        {(router.query.workspaceSlug || router.query.appSlug) && (
          <Breadcrumbs aria-label="Workspace breadcrumbs" />
        )}
      </div>

      <div className="hidden grid-flow-col items-center gap-2 sm:grid">
        {isPlatform && (
          <Dropdown.Root>
            <Dropdown.Trigger
              hideChevron
              className="rounded-md px-2.5 py-1.5 text-sm hover:bg-gray-100 motion-safe:transition-colors"
            >
              Feedback
            </Dropdown.Trigger>

            <Dropdown.Content
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <FeedbackForm className="max-w-md" />
            </Dropdown.Content>
          </Dropdown.Root>
        )}

        <NavLink
          href="https://docs.nhost.io"
          className="mr-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-gray-100 motion-safe:transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs
        </NavLink>

        {isPlatform && <AccountMenu />}
      </div>

      <MobileNav className="sm:hidden" />
    </header>
  );
}
