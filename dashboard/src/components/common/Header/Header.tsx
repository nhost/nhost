import Breadcrumbs from '@/components/common/Breadcrumbs';
import FeedbackForm from '@/components/common/FeedbackForm';
import Logo from '@/components/common/Logo';
import MobileNav from '@/components/common/MobileNav';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';
import { AccountMenu } from '@/components/dashboard/AccountMenu';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import Box from '@/ui/v2/Box';
import { Dropdown } from '@/ui/v2/Dropdown';
import Link from '@/ui/v2/Link';
import NavLink from 'next/link';
import { useRouter } from 'next/router';
import type { DetailedHTMLProps, HTMLProps, PropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';

export interface HeaderProps
  extends PropsWithoutRef<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
  > {}

export default function Header({ className, ...props }: HeaderProps) {
  const router = useRouter();
  const isPlatform = useIsPlatform();

  return (
    <Box
      className={twMerge(
        'z-40 grid w-full transform-gpu grid-flow-col items-center justify-between gap-2 border-b-1 px-4 py-3',
        className,
      )}
      sx={{ backgroundColor: 'background.paper' }}
      {...props}
    >
      <div className="grid grid-flow-col items-center gap-3">
        <NavLink href="/" passHref>
          <Link href="/" className="w-12">
            <Logo className="mx-auto cursor-pointer" />
          </Link>
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
              className="rounded-md px-2.5 py-1.5 text-sm motion-safe:transition-colors"
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
          passHref
          target="_blank"
          rel="noopener noreferrer"
        >
          <Link
            underline="none"
            href="https://docs.nhost.io"
            className="mr-2 rounded-md px-2.5 py-1.5 text-sm motion-safe:transition-colors"
            sx={{
              color: 'text.primary',
              '&:hover': { backgroundColor: 'grey.200' },
            }}
          >
            Docs
          </Link>
        </NavLink>

        {isPlatform ? <AccountMenu /> : <ThemeSwitcher className="w-52" />}
      </div>

      <MobileNav className="sm:hidden" />
    </Box>
  );
}
