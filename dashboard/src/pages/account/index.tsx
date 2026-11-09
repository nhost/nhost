import type { ComponentType, ReactElement } from 'react';
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
import { AccountMfaSettings } from '@/features/account/settings/components/AccountMfaSettings';
import { AccountProfileHeader } from '@/features/account/settings/components/AccountProfileHeader';
import { AccountSettingsLayout } from '@/features/account/settings/components/AccountSettingsLayout';
import { DeleteAccount } from '@/features/account/settings/components/DeleteAccount';
import { DisplayNameSetting } from '@/features/account/settings/components/DisplayNameSetting';
import { EmailSetting } from '@/features/account/settings/components/EmailSetting';
import { PATSettings } from '@/features/account/settings/components/PATSettings';
import { PasswordSettings } from '@/features/account/settings/components/PasswordSettings';
import { SecurityKeysSettings } from '@/features/account/settings/components/SecurityKeysSettings';
import { SocialProvidersSettings } from '@/features/account/settings/components/SocialProvidersSettings';
import { SettingsArea } from '@/features/orgs/projects/common/components/settings/SettingsArea';
import useActiveSettingsTab from '@/features/orgs/projects/common/components/settings/SettingsTabs/hooks/useActiveSettingsTab';
import { AreaSidebarLayout } from '@/features/orgs/projects/common/layout/AreaSidebarLayout';
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
  password: PasswordSettings,
  'two-factor-authentication': AccountMfaSettings,
  'security-keys': SecurityKeysSettings,
  'connected-accounts': SocialProvidersSettings,
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
        <AreaSidebarLayout sidebar={<AccountSettingsNavigation />}>
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
        </AreaSidebarLayout>
      </div>
    </>
  );
}

AccountSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <AccountSettingsLayout>{page}</AccountSettingsLayout>;
};
