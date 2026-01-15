import { useApolloClient } from '@apollo/client';
import getConfig from 'next/config';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { NavLink } from '@/components/common/NavLink';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import type { ButtonProps } from '@/components/ui/v2/Button';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { Drawer } from '@/components/ui/v2/Drawer';
import { MenuIcon } from '@/components/ui/v2/icons/MenuIcon';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAuth } from '@/providers/Auth';

export interface MobileNavProps extends ButtonProps {}

export default function MobileNav({ className, ...props }: MobileNavProps) {
  const isPlatform = useIsPlatform();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signout } = useAuth();
  const apolloClient = useApolloClient();
  const router = useRouter();
  const { publicRuntimeConfig } = getConfig();

  async function handleSignOut() {
    setMenuOpen(false);
    await apolloClient.clearStore();
    await signout();
    await router.push('/signin');
  }

  return (
    <>
      <Button
        variant="borderless"
        color="secondary"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        className={twMerge('min-w-0 p-0', className)}
        onClick={() => setMenuOpen((current) => !current)}
        {...props}
      >
        {menuOpen ? <XIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
      </Button>

      <Drawer
        anchor="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        className="z-[39] w-full sm:hidden"
        hideCloseButton
        componentsProps={{ backdrop: { className: 'pt-18' } }}
        PaperProps={{
          className: 'w-full px-4 pt-18 pb-12 grid grid-flow-row gap-6',
        }}
      >
        <section className="mt-2 grid grid-flow-row gap-3">
          <Text variant="h2" className="font-semibold text-xl">
            Resources
          </Text>

          <List className="grid grid-flow-row gap-2">
            {isPlatform && (
              <ListItem.Root>
                <ListItem.Button
                  component={NavLink}
                  href="/support"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ListItem.Text>Contact us</ListItem.Text>
                </ListItem.Button>
              </ListItem.Root>
            )}

            <Divider component="li" />

            <ListItem.Root>
              <ListItem.Button
                component={NavLink}
                href="https://docs.nhost.io"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ListItem.Text>Docs</ListItem.Text>
              </ListItem.Button>
            </ListItem.Root>
          </List>
        </section>

        <section className={twMerge('grid grid-flow-row gap-3')}>
          <Text variant="h2" className="font-semibold text-xl">
            Theme
          </Text>

          <ThemeSwitcher aria-label="Theme" />
        </section>

        {isPlatform && (
          <section className={twMerge('grid grid-flow-row gap-3')}>
            <Text variant="h2" className="font-semibold text-xl">
              Account
            </Text>

            <List className="grid grid-flow-row gap-2">
              <ListItem.Root>
                <ListItem.Button
                  component={NavLink}
                  variant="borderless"
                  color="secondary"
                  className="w-full justify-start border-none px-2 py-2.5 text-[16px]"
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                >
                  Account Settings
                </ListItem.Button>
              </ListItem.Root>

              <Divider component="li" />

              <ListItem.Root>
                <ListItem.Button
                  variant="borderless"
                  sx={{ color: 'error.main' }}
                  className="justify-start border-none px-2 py-2.5 text-[16px]"
                  onClick={handleSignOut}
                >
                  Sign Out
                </ListItem.Button>
              </ListItem.Root>
            </List>

            <Text className="text-center text-xs" color="secondary">
              Dashboard Version: {publicRuntimeConfig?.version || 'n/a'}
            </Text>
          </section>
        )}
      </Drawer>
    </>
  );
}
