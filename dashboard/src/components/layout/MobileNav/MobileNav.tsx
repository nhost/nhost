import { useApolloClient } from '@apollo/client';
import { MenuIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { ListNavLink } from '@/components/common/NavLink';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/v3/sheet';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';
import { getDashboardVersion } from '@/utils/env';

export interface MobileNavProps extends ButtonProps {}

export default function MobileNav({ className, ...props }: MobileNavProps) {
  const isPlatform = useIsPlatform();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signout } = useAuth();
  const apolloClient = useApolloClient();
  const router = useRouter();

  async function handleSignOut() {
    setMenuOpen(false);
    await apolloClient.clearStore();
    await signout();
    await router.push('/signin');
  }

  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className={cn('min-w-0 p-0', className)}
          {...props}
        >
          {menuOpen ? (
            <XIcon className="h-5 w-5" />
          ) : (
            <MenuIcon className="h-5 w-5" />
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        hideCloseButton
        className="box z-[39] grid w-full max-w-none grid-flow-row gap-6 px-4 pt-18 pb-12 sm:hidden"
      >
        <SheetHeader>
          <SheetTitle className="sr-only">Mobile navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Nhost Dashboard Mobile Navigation
          </SheetDescription>
        </SheetHeader>

        <section className="mt-2 grid grid-flow-row gap-3">
          <h2 className="font-semibold text-xl">Resources</h2>

          <ul className="grid grid-flow-row gap-2">
            {isPlatform && (
              <li>
                <ListNavLink
                  className="h-11"
                  href="/support"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contact us
                </ListNavLink>
              </li>
            )}

            <li aria-hidden="true">
              <Separator />
            </li>

            <li>
              <ListNavLink
                className="h-11"
                href="https://docs.nhost.io"
                target="_blank"
                rel="noopener noreferrer"
              >
                Docs
              </ListNavLink>
            </li>
          </ul>
        </section>

        <section className="grid grid-flow-row gap-3">
          <ThemeSwitcher layout="mobile" />
        </section>

        {isPlatform && (
          <section className="grid grid-flow-row gap-3">
            <h2 className="font-semibold text-xl">Account</h2>

            <ul className="grid grid-flow-row gap-2">
              <li>
                <ListNavLink
                  className="h-11 w-full justify-start border-none px-2 py-2.5 text-[16px]"
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                >
                  Account Settings
                </ListNavLink>
              </li>

              <li aria-hidden="true">
                <Separator />
              </li>

              <li>
                <Button
                  variant="ghost"
                  className="h-11 w-full justify-start border-none px-2 py-2.5 text-[16px] text-error-main hover:bg-error-bg"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </li>
            </ul>

            <p className="text-center text-muted-foreground text-xs">
              Dashboard Version: {getDashboardVersion()}
            </p>
          </section>
        )}
      </SheetContent>
    </Sheet>
  );
}
