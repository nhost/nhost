import { MenuIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { ListNavLink } from '@/components/common/NavLink';
import AccountMenuContent from '@/components/layout/AccountMenu/AccountMenuContent';
import AccountMenuUserInfo from '@/components/layout/AccountMenu/AccountMenuUserInfo';
import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/v3/sheet';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { cn } from '@/lib/utils';

export interface MobileNavProps extends ButtonProps {}

export default function MobileNav({ className, ...props }: MobileNavProps) {
  const isPlatform = useIsPlatform();
  const [menuOpen, setMenuOpen] = useState(false);

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
        className="box z-[39] grid w-full max-w-none grid-flow-row content-start gap-6 px-4 pt-18 pb-12 sm:hidden"
      >
        <SheetTitle className="sr-only">Mobile navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Nhost Dashboard Mobile Navigation
        </SheetDescription>

        <AccountMenuUserInfo />

        <Separator />

        <section className="grid grid-flow-row gap-3">
          <h2 className="font-semibold text-xl">Resources</h2>

          <ul className="flex flex-col gap-2">
            {isPlatform && (
              <li>
                <ListNavLink
                  className="h-9"
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
                className="h-9"
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
          <AccountMenuContent
            onAccountSettingsClick={() => setMenuOpen(false)}
          />
        </section>
      </SheetContent>
    </Sheet>
  );
}
