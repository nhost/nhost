import NavLink from '@/components/common/NavLink';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import FloatingActionButton from '@/ui/FloatingActionButton';
import Backdrop from '@/ui/v2/Backdrop';
import type { BoxProps } from '@/ui/v2/Box';
import Box from '@/ui/v2/Box';
import List from '@/ui/v2/List';
import type { ListItemButtonProps } from '@/ui/v2/ListItem';
import { ListItem } from '@/ui/v2/ListItem';
import { isK8SPostgresEnabledInCurrentEnvironment } from '@/utils/helpers';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface SettingsSidebarProps extends Omit<BoxProps, 'children'> {}

interface SettingsNavLinkProps extends ListItemButtonProps {
  /**
   * Link to navigate to.
   */
  href: string;
  /**
   * Determines whether or not the link should be active if it's href exactly
   * matches the current route.
   *
   * @default true
   */
  exact?: boolean;
}

function SettingsNavLink({
  exact = true,
  href,
  children,
  ...props
}: SettingsNavLinkProps) {
  const router = useRouter();
  const baseUrl = `/${router.query.workspaceSlug}/${router.query.appSlug}/settings`;
  const finalUrl = href && href !== '/' ? `${baseUrl}${href}` : baseUrl;

  const active = exact
    ? router.asPath === finalUrl
    : router.asPath.startsWith(finalUrl);

  return (
    <ListItem.Root>
      <ListItem.Button
        dense
        href={finalUrl}
        component={NavLink}
        selected={active}
        {...props}
      >
        <ListItem.Text>{children}</ListItem.Text>
      </ListItem.Button>
    </ListItem.Root>
  );
}

export default function SettingsSidebar({
  className,
  ...props
}: SettingsSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const isProjectUsingRDS = currentApplication?.featureFlags?.some(
    (feature) => feature.name === 'fleetcontrol_use_rds',
  );

  function toggleExpanded() {
    setExpanded(!expanded);
  }

  function handleSelect() {
    setExpanded(false);
  }

  function closeSidebarWhenEscapeIsPressed(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      setExpanded(false);
    }
  }

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', closeSidebarWhenEscapeIsPressed);
    }

    return () =>
      document.removeEventListener('keydown', closeSidebarWhenEscapeIsPressed);
  }, []);

  if (!currentApplication) {
    return null;
  }

  return (
    <>
      <Backdrop
        open={expanded}
        className="absolute top-0 left-0 bottom-0 right-0 z-[34] md:hidden"
        role="button"
        tabIndex={-1}
        onClick={() => setExpanded(false)}
        aria-label="Close sidebar overlay"
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }

          setExpanded(false);
        }}
      />

      <Box
        component="aside"
        className={twMerge(
          'absolute top-0 z-[35] h-full w-full overflow-auto border-r-1 px-2 pt-2 pb-17 motion-safe:transition-transform md:relative md:z-0 md:h-full md:py-2.5 md:transition-none',
          expanded ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          className,
        )}
        {...props}
      >
        <nav aria-label="Settings navigation">
          <List className="grid gap-2">
            <SettingsNavLink
              href="/general"
              exact={false}
              onClick={handleSelect}
            >
              General
            </SettingsNavLink>
            {isK8SPostgresEnabledInCurrentEnvironment && !isProjectUsingRDS && (
              <SettingsNavLink
                href="/database"
                exact={false}
                onClick={handleSelect}
              >
                Database
              </SettingsNavLink>
            )}
            <SettingsNavLink
              href="/authentication"
              exact={false}
              onClick={handleSelect}
            >
              Authentication
            </SettingsNavLink>
            <SettingsNavLink
              href="/sign-in-methods"
              exact={false}
              onClick={handleSelect}
            >
              Sign-In Methods
            </SettingsNavLink>

            <SettingsNavLink
              href="/roles-and-permissions"
              exact={false}
              onClick={handleSelect}
            >
              Roles and Permissions
            </SettingsNavLink>

            <SettingsNavLink href="/smtp" exact={false} onClick={handleSelect}>
              SMTP
            </SettingsNavLink>

            <SettingsNavLink href="/git" exact={false} onClick={handleSelect}>
              Git
            </SettingsNavLink>

            <SettingsNavLink
              href="/environment-variables"
              exact={false}
              onClick={handleSelect}
            >
              Environment Variables
            </SettingsNavLink>
          </List>
        </nav>
      </Box>

      <FloatingActionButton
        className="absolute bottom-4 left-4 z-[38] md:hidden"
        onClick={toggleExpanded}
        aria-label="Toggle sidebar"
      >
        <Image
          width={16}
          height={16}
          src="/assets/table.svg"
          alt="A monochrome table"
        />
      </FloatingActionButton>
    </>
  );
}
