import {
  type ComponentType,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  ACCOUNT_SETTINGS_DEFAULT_TAB,
  ACCOUNT_SETTINGS_GROUPS,
  ACCOUNT_SETTINGS_TABS,
  type AccountSettingsTab,
  getAccountSettingsHref,
} from '@/features/account/settings/accountSettingsTabs';
import { AccountProfileHeader } from '@/features/account/settings/components/AccountProfileHeader';
import { AccountSettingsLayout } from '@/features/account/settings/components/AccountSettingsLayout';
import { AuthenticationSettings } from '@/features/account/settings/components/AuthenticationSettings';
import { DeleteAccount } from '@/features/account/settings/components/DeleteAccount';
import { DisplayNameSetting } from '@/features/account/settings/components/DisplayNameSetting';
import { EmailSetting } from '@/features/account/settings/components/EmailSetting';
import { PATSettings } from '@/features/account/settings/components/PATSettings';
import { SessionsSettings } from '@/features/account/settings/components/SessionsSettings';
import { SettingsArea } from '@/features/orgs/projects/common/components/settings/SettingsArea';
import useActiveSettingsTab from '@/features/orgs/projects/common/components/settings/SettingsTabs/hooks/useActiveSettingsTab';
import {
  useGetAuthUserProvidersQuery,
  useGetPersonalAccessTokensQuery,
} from '@/generated/graphql';

function GeneralSettings() {
  return (
    <div className="grid grid-flow-row gap-6">
      <RetryableErrorBoundary>
        <DisplayNameSetting />
      </RetryableErrorBoundary>

      <RetryableErrorBoundary>
        <EmailSetting />
      </RetryableErrorBoundary>

      <DeleteAccount />
    </div>
  );
}

const ACCOUNT_SETTINGS_PAGES: Record<AccountSettingsTab, ComponentType> = {
  general: GeneralSettings,
  authentication: AuthenticationSettings,
  sessions: SessionsSettings,
  'personal-access-tokens': PATSettings,
};

function AccountSettingsNavigation() {
  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Account settings navigation">
        {ACCOUNT_SETTINGS_GROUPS.map(({ label, tabs }) => (
          <AreaSidebarGroup key={label} label={label}>
            {tabs.map((tab) => (
              <AreaSidebarLink
                key={tab}
                href={getAccountSettingsHref(tab)}
                exact
                shallow
              >
                {ACCOUNT_SETTINGS_TABS[tab].title}
              </AreaSidebarLink>
            ))}
          </AreaSidebarGroup>
        ))}
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

/**
 * Same columns as `AreaSidebarLayout`, but the whole area scrolls as one, so
 * the wheel works over the menu too. The profile header and the menu are
 * sticky, and the pages slide under the frosted header while you scroll.
 */
function AccountSettingsColumns({
  header,
  sidebar,
  children,
}: {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // The header height changes with the screen size (it is hidden on phones)
  // so the sticky menu and the anchor offsets follow it.
  useEffect(() => {
    const element = headerRef.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(() =>
      setHeaderHeight(element.offsetHeight),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="h-full overflow-y-auto"
      onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}
      style={
        { '--account-header-height': `${headerHeight}px` } as CSSProperties
      }
    >
      {/* `data-scrolled` turns on the header shadow and glowing edge. */}
      <div
        data-scrolled={scrolled}
        className="group/account-header sticky top-0 z-20"
        ref={headerRef}
      >
        {header}
      </div>

      <div className="flex flex-col md:grid md:grid-cols-[1fr_14rem_minmax(0,58rem)_1fr]">
        <div className="sticky top-[var(--account-header-height)] z-10 bg-background py-4 md:col-span-2 md:flex md:justify-end md:self-start md:bg-transparent md:py-8">
          {sidebar}
        </div>

        <div className="md:col-span-2 md:pt-8">
          <div className="max-w-[58rem] pb-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function AccountSettingsContent() {
  const tab = useActiveSettingsTab(
    ACCOUNT_SETTINGS_TABS,
    ACCOUNT_SETTINGS_DEFAULT_TAB,
  );

  if (!tab) {
    return null;
  }

  const Page = ACCOUNT_SETTINGS_PAGES[tab];

  return (
    <div className="grid grid-flow-row gap-6">
      <h1 className="font-semibold text-2.5xl">
        {ACCOUNT_SETTINGS_TABS[tab].title}
      </h1>
      <RetryableErrorBoundary>
        <Page />
      </RetryableErrorBoundary>
    </div>
  );
}

export default function AccountSettingsPage() {
  const {
    data: personalAccessTokensData,
    loading: loadingPersonalAccessTokens,
  } = useGetPersonalAccessTokensQuery();
  const { data: authUserProvidersData, loading: loadingAuthUserProviders } =
    useGetAuthUserProvidersQuery();

  const isInitialLoading =
    (!personalAccessTokensData && loadingPersonalAccessTokens) ||
    (!authUserProvidersData && loadingAuthUserProviders);

  return (
    <div className="min-h-0 flex-1">
      <AccountSettingsColumns
        header={<AccountProfileHeader />}
        sidebar={<AccountSettingsNavigation />}
      >
        <SettingsArea className="py-0">
          {/* Only the settings wait for the first load: the profile and
                the menu show right away. */}
          {isInitialLoading ? (
            <Spinner size="medium" wrapperClassName="gap-2">
              Loading account settings...
            </Spinner>
          ) : (
            <AccountSettingsContent />
          )}
        </SettingsArea>
      </AccountSettingsColumns>
    </div>
  );
}

AccountSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <AccountSettingsLayout>{page}</AccountSettingsLayout>;
};
