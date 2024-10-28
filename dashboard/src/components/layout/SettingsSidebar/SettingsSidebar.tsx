import { NavLink } from '@/components/common/NavLink';
import { Backdrop } from '@/components/ui/v2/Backdrop';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { IconButton } from '@/components/ui/v2/IconButton';
import { SlidersIcon } from '@/components/ui/v2/icons/SlidersIcon';
import { List } from '@/components/ui/v2/List';
import type { ListItemButtonProps } from '@/components/ui/v2/ListItem';
import { ListItem } from '@/components/ui/v2/ListItem';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
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
  /**
   * Class name passed to the text element.
   */
  textClassName?: string;
}

function SettingsNavLink({
  exact = true,
  href,
  children,
  textClassName,
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
        <ListItem.Text className={textClassName}>{children}</ListItem.Text>
      </ListItem.Button>
    </ListItem.Root>
  );
}

export default function SettingsSidebar({
  className,
  ...props
}: SettingsSidebarProps) {
  const isPlatform = useIsPlatform();
  const [expanded, setExpanded] = useState(false);
  const { currentProject } = useCurrentWorkspaceAndProject();

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

  if (!currentProject) {
    return null;
  }

  return (
    <>
      <Backdrop
        open={expanded}
        className="absolute bottom-0 left-0 right-0 top-0 z-[34] md:hidden"
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
          'absolute top-0 z-[35] flex h-full w-full flex-col justify-between overflow-auto border-r-1 pb-17 pt-2 motion-safe:transition-transform md:relative md:z-0 md:h-full md:pb-0 md:pt-2.5 md:transition-none',
          expanded ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          className,
        )}
        {...props}
      >
        <nav aria-label="Settings navigation" className="px-2">
          <List className="grid gap-2">
            <SettingsNavLink
              href="/general"
              exact={false}
              onClick={handleSelect}
            >
              General
            </SettingsNavLink>
            <SettingsNavLink
              href="/resources"
              exact={false}
              onClick={handleSelect}
            >
              Compute Resources
            </SettingsNavLink>
            <SettingsNavLink
              href="/database"
              exact={false}
              onClick={handleSelect}
            >
              Database
            </SettingsNavLink>
            <SettingsNavLink
              href="/hasura"
              exact={false}
              onClick={handleSelect}
            >
              Hasura
            </SettingsNavLink>
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
              href="/storage"
              exact={false}
              onClick={handleSelect}
            >
              Storage
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

            <SettingsNavLink
              href="/git"
              exact={false}
              onClick={handleSelect}
              disabled={!isPlatform}
            >
              Git
            </SettingsNavLink>

            <SettingsNavLink
              href="/environment-variables"
              exact={false}
              onClick={handleSelect}
            >
              Environment Variables
            </SettingsNavLink>

            <SettingsNavLink
              href="/secrets"
              exact={false}
              onClick={handleSelect}
            >
              Secrets
            </SettingsNavLink>

            <SettingsNavLink
              href="/custom-domains"
              exact={false}
              onClick={handleSelect}
            >
              Custom Domains
            </SettingsNavLink>
            <SettingsNavLink
              href="/rate-limiting"
              exact={false}
              onClick={handleSelect}
            >
              Rate Limiting
            </SettingsNavLink>
            <SettingsNavLink href="/ai" exact={false} onClick={handleSelect}>
              AI
            </SettingsNavLink>
          </List>
        </nav>
        <Box className="border-t">
          <SettingsNavLink
            href="/editor"
            exact={false}
            onClick={handleSelect}
            className="flex w-full border group-focus-within:pr-9 group-hover:pr-9 group-active:pr-9"
            textClassName="flex w-full justify-center"
          >
            <div className="flex w-full flex-row items-center justify-center space-x-4 py-2.5">
              <SlidersIcon />
              <span className="flex">Configuration Editor</span>
            </div>
          </SettingsNavLink>
        </Box>
      </Box>

      <IconButton
        className="absolute bottom-4 left-4 z-[38] h-11 w-11 rounded-full md:hidden"
        onClick={toggleExpanded}
        aria-label="Toggle sidebar"
      >
        <Image
          width={16}
          height={16}
          src="/assets/table.svg"
          alt="A monochrome table"
        />
      </IconButton>
    </>
  );
}
