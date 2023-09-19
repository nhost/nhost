import { ContactUs } from '@/components/common/ContactUs';
import { NavLink } from '@/components/common/NavLink';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { Nav } from '@/components/presentational/Nav';
import type { ButtonProps } from '@/components/ui/v2/Button';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { Drawer } from '@/components/ui/v2/Drawer';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { MenuIcon } from '@/components/ui/v2/icons/MenuIcon';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import { List } from '@/components/ui/v2/List';
import type { ListItemButtonProps } from '@/components/ui/v2/ListItem';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useNavigationVisible } from '@/features/projects/common/hooks/useNavigationVisible';
import { useProjectRoutes } from '@/features/projects/common/hooks/useProjectRoutes';
import { useApolloClient } from '@apollo/client';
import { useSignOut } from '@nhost/nextjs';
import getConfig from 'next/config';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { cloneElement, Fragment, isValidElement, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface MobileNavProps extends ButtonProps {}

interface MobileNavLinkProps extends ListItemButtonProps {
  /**
   * Link to navigate to.
   */
  href: string;
  /**
   * Determines whether or not the link should be active if it's href exactly
   * matches the current route.
   */
  exact?: boolean;
  /**
   * Icon to display next to the text.
   */
  icon?: ReactNode;
}

function MobileNavLink({
  className,
  exact = true,
  href,
  icon,
  ...props
}: MobileNavLinkProps) {
  const router = useRouter();
  const baseUrl = `/${router.query.workspaceSlug}/${router.query.appSlug}`;
  const finalUrl = href && href !== '/' ? `${baseUrl}${href}` : baseUrl;

  const active = exact
    ? router.asPath === finalUrl
    : router.asPath.startsWith(finalUrl);

  return (
    <ListItem.Root
      className={twMerge('grid grid-flow-row gap-2 py-2', className)}
    >
      <ListItem.Button
        className="w-full"
        component={NavLink}
        href={finalUrl}
        selected={active}
        {...props}
      >
        <ListItem.Icon>
          {isValidElement(icon)
            ? cloneElement(icon, { ...icon.props, className: 'w-4.5 h-4.5' })
            : null}
        </ListItem.Icon>

        <ListItem.Text>{props.children}</ListItem.Text>
      </ListItem.Button>
    </ListItem.Root>
  );
}
export default function MobileNav({ className, ...props }: MobileNavProps) {
  const isPlatform = useIsPlatform();
  const { allRoutes } = useProjectRoutes();
  const shouldDisplayNav = useNavigationVisible();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut } = useSignOut();
  const apolloClient = useApolloClient();
  const router = useRouter();
  const { publicRuntimeConfig } = getConfig();

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
        {shouldDisplayNav && (
          <section>
            <Nav
              flow="row"
              className="w-full"
              aria-label="Mobile navigation"
              listProps={{ className: 'gap-2' }}
            >
              <List>
                {allRoutes.map(
                  ({ relativePath, label, icon, exact, disabled }, index) => (
                    <Fragment key={relativePath}>
                      <MobileNavLink
                        href={relativePath}
                        className="w-full"
                        exact={exact}
                        icon={icon}
                        onClick={() => setMenuOpen(false)}
                        disabled={disabled}
                      >
                        {label}
                      </MobileNavLink>

                      {index < allRoutes.length - 1 && (
                        <Divider component="li" />
                      )}
                    </Fragment>
                  ),
                )}
              </List>
            </Nav>
          </section>
        )}

        <section
          className={twMerge(
            'grid grid-flow-row gap-3',
            !shouldDisplayNav && 'mt-2',
          )}
        >
          <Text variant="h2" className="text-xl font-semibold">
            Resources
          </Text>

          <List className="grid grid-flow-row gap-2">
            {isPlatform && (
              <Dropdown.Root>
                <Dropdown.Trigger
                  className="justify-initial w-full"
                  hideChevron
                  asChild
                >
                  <ListItem.Root>
                    <ListItem.Button
                      component="span"
                      className="w-full"
                      role={undefined}
                    >
                      <ListItem.Text>Contact us</ListItem.Text>
                    </ListItem.Button>
                  </ListItem.Root>
                </Dropdown.Trigger>

                <Dropdown.Content
                  transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                  <ContactUs className="max-w-md" />
                </Dropdown.Content>
              </Dropdown.Root>
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
          <Text variant="h2" className="text-xl font-semibold">
            Theme
          </Text>

          <ThemeSwitcher aria-label="Theme" />
        </section>

        {isPlatform && (
          <section className={twMerge('grid grid-flow-row gap-3')}>
            <Text variant="h2" className="text-xl font-semibold">
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
                  onClick={async () => {
                    setMenuOpen(false);
                    await apolloClient.clearStore();
                    await signOut();
                    await router.push('/signin');
                  }}
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
