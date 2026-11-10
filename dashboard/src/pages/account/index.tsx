import type { ComponentType, ReactElement, ReactNode } from 'react';
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
 * Same columns as `AreaSidebarLayout`, but the whole area under the profile
 * header scrolls as one, so the wheel works over the menu too. The menu is
 * sticky, so it stays in view while the page scrolls.
 */
function AccountSettingsColumns({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col md:grid md:grid-cols-[1fr_14rem_minmax(0,58rem)_1fr]">
        <div className="sticky top-0 z-10 bg-background py-4 md:col-span-2 md:flex md:justify-end md:self-start md:bg-transparent md:py-8">
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
    <>
      <AccountProfileHeader />
      <div className="min-h-0 flex-1">
        <AccountSettingsColumns sidebar={<AccountSettingsNavigation />}>
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
    </>
  );
}

AccountSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <AccountSettingsLayout>{page}</AccountSettingsLayout>;
};
