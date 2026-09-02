import { SettingsIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import { type ReactElement, useEffect, useState } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import {
  SectionSidebarButton,
  SectionSidebarGroup,
  SectionSidebarNav,
} from '@/components/layout/SectionSidebar';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Button } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { getAuthLayout } from '@/features/orgs/projects/authentication/layout';
import { MIN_AUTH_VERSION_OAUTH2 } from '@/features/orgs/projects/authentication/oauth2/constants';
import { AllowedEmailSettings } from '@/features/orgs/projects/authentication/settings/components/AllowedEmailSettings';
import { AllowedRedirectURLsSettings } from '@/features/orgs/projects/authentication/settings/components/AllowedRedirectURLsSettings';
import { AnonymousSignInSettings } from '@/features/orgs/projects/authentication/settings/components/AnonymousSignInSettings';
import { AppleProviderSettings } from '@/features/orgs/projects/authentication/settings/components/AppleProviderSettings';
import { AuthServiceVersionSettings } from '@/features/orgs/projects/authentication/settings/components/AuthServiceVersionSettings';
import { AzureADProviderSettings } from '@/features/orgs/projects/authentication/settings/components/AzureADProviderSettings';
import { BlockedEmailSettings } from '@/features/orgs/projects/authentication/settings/components/BlockedEmailSettings';
import { ClientURLSettings } from '@/features/orgs/projects/authentication/settings/components/ClientURLSettings';
import { ConcealErrorsSettings } from '@/features/orgs/projects/authentication/settings/components/ConcealErrorsSettings';
import DeleteSMTPSettings from '@/features/orgs/projects/authentication/settings/components/DeleteSMTPSettings/DeleteSMTPSettings';
import { DiscordProviderSettings } from '@/features/orgs/projects/authentication/settings/components/DiscordProviderSettings';
import { EmailAndPasswordSettings } from '@/features/orgs/projects/authentication/settings/components/EmailAndPasswordSettings';
import { EntraIDProviderSettings } from '@/features/orgs/projects/authentication/settings/components/EntraIDProviderSettings';
import { FacebookProviderSettings } from '@/features/orgs/projects/authentication/settings/components/FacebookProviderSettings';
import { GitHubProviderSettings } from '@/features/orgs/projects/authentication/settings/components/GitHubProviderSettings';
import { GoogleProviderSettings } from '@/features/orgs/projects/authentication/settings/components/GoogleProviderSettings';
import { GravatarSettings } from '@/features/orgs/projects/authentication/settings/components/GravatarSettings';
import { LinkedInProviderSettings } from '@/features/orgs/projects/authentication/settings/components/LinkedInProviderSettings';
import { MagicLinkSettings } from '@/features/orgs/projects/authentication/settings/components/MagicLinkSettings';
import { MFASettings } from '@/features/orgs/projects/authentication/settings/components/MFASettings';
import { OAuth2ProviderSettings } from '@/features/orgs/projects/authentication/settings/components/OAuth2ProviderSettings';
import { PostmarkSettings } from '@/features/orgs/projects/authentication/settings/components/PostmarkSettings';
import { SessionSettings } from '@/features/orgs/projects/authentication/settings/components/SessionSettings';
import { SMSSettings } from '@/features/orgs/projects/authentication/settings/components/SMSSettings';
import { SMTPSettings } from '@/features/orgs/projects/authentication/settings/components/SMTPSettings';
import { SpotifyProviderSettings } from '@/features/orgs/projects/authentication/settings/components/SpotifyProviderSettings';
import { TwitchProviderSettings } from '@/features/orgs/projects/authentication/settings/components/TwitchProviderSettings';
import { TwitterProviderSettings } from '@/features/orgs/projects/authentication/settings/components/TwitterProviderSettings';
import { UserCreationSettings } from '@/features/orgs/projects/authentication/settings/components/UserCreationSettings';
import { WebAuthnSettings } from '@/features/orgs/projects/authentication/settings/components/WebAuthnSettings';
import { WindowsLiveProviderSettings } from '@/features/orgs/projects/authentication/settings/components/WindowsLiveProviderSettings';
import { WorkOsProviderSettings } from '@/features/orgs/projects/authentication/settings/components/WorkOsProviderSettings';
import { OTPEmailSettings } from '@/features/orgs/projects/authentication/settings/OTPEmailSettings';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSoftwareVersionsInfo } from '@/features/orgs/projects/common/hooks/useSoftwareVersionsInfo';
import { AuthDomain } from '@/features/orgs/projects/custom-domains/settings/components/AuthDomain';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { JWTSettings } from '@/features/orgs/projects/jwt/settings/components/JWTSettings';
import { PermissionVariableSettings } from '@/features/orgs/projects/permissions/settings/components/PermissionVariableSettings';
import { AuthLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/AuthLimitingForm';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { RoleSettings } from '@/features/orgs/projects/roles/settings/components/RoleSettings';
import {
  useGetAuthenticationSettingsQuery,
  useGetJwtSecretsQuery,
  useGetOAuth2ProviderSettingsQuery,
  useGetRolesPermissionsQuery,
  useGetSignInMethodsQuery,
  useGetSmtpSettingsQuery,
} from '@/generated/graphql';
import { isVersionGte } from '@/utils/compareVersions';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

type AuthSettingsTab =
  | 'sign-in-methods'
  | 'oauth2-provider'
  | 'smtp'
  | 'authentication'
  | 'roles-and-permissions'
  | 'jwt'
  | 'custom-domain'
  | 'rate-limiting';

const AUTH_SETTINGS_DEFAULT_TAB: AuthSettingsTab = 'sign-in-methods';

function isAuthSettingsTab(
  value: string | undefined,
): value is AuthSettingsTab {
  return (
    value === 'sign-in-methods' ||
    value === 'oauth2-provider' ||
    value === 'smtp' ||
    value === 'authentication' ||
    value === 'roles-and-permissions' ||
    value === 'jwt' ||
    value === 'custom-domain' ||
    value === 'rate-limiting'
  );
}

function getAuthSettingsTab(
  value: string | string[] | undefined,
): AuthSettingsTab {
  const tab = getSingleQueryParam(value);

  if (!isAuthSettingsTab(tab)) {
    return AUTH_SETTINGS_DEFAULT_TAB;
  }

  return tab;
}

function useAuthSettingsTab() {
  const router = useRouter();
  const activeTab = getAuthSettingsTab(router.query.tab);

  function setActiveTab(nextTab: AuthSettingsTab) {
    const nextQuery = { ...router.query };

    if (nextTab === AUTH_SETTINGS_DEFAULT_TAB) {
      delete nextQuery.tab;
    } else {
      nextQuery.tab = nextTab;
    }

    void router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  return { activeTab, setActiveTab };
}

function AuthSettingsSidebar() {
  const { activeTab, setActiveTab } = useAuthSettingsTab();

  return (
    <FeatureSidebar
      className="w-[280px] max-w-[280px] border-r-0 bg-background-default"
      mobileBreakpoint="md"
      toggleIcon={<SettingsIcon className="h-4 w-4 text-white" />}
      toggleOffset="left-8"
    >
      <SectionSidebarNav ariaLabel="Auth settings navigation">
        <SectionSidebarGroup label="SIGN-IN">
          <SectionSidebarButton
            active={activeTab === 'sign-in-methods'}
            onClick={() => setActiveTab('sign-in-methods')}
          >
            Sign-In Methods
          </SectionSidebarButton>
          <SectionSidebarButton
            active={activeTab === 'oauth2-provider'}
            onClick={() => setActiveTab('oauth2-provider')}
          >
            OAuth2 Provider
          </SectionSidebarButton>
          <SectionSidebarButton
            active={activeTab === 'smtp'}
            onClick={() => setActiveTab('smtp')}
          >
            SMTP
          </SectionSidebarButton>
        </SectionSidebarGroup>

        <SectionSidebarGroup label="USERS AND ACCESS">
          <SectionSidebarButton
            active={activeTab === 'authentication'}
            onClick={() => setActiveTab('authentication')}
          >
            Authentication
          </SectionSidebarButton>
          <SectionSidebarButton
            active={activeTab === 'roles-and-permissions'}
            onClick={() => setActiveTab('roles-and-permissions')}
          >
            Roles and Permissions
          </SectionSidebarButton>
          <SectionSidebarButton
            active={activeTab === 'jwt'}
            onClick={() => setActiveTab('jwt')}
          >
            JWT
          </SectionSidebarButton>
        </SectionSidebarGroup>

        <SectionSidebarGroup label="CONNECTIVITY">
          <SectionSidebarButton
            active={activeTab === 'custom-domain'}
            onClick={() => setActiveTab('custom-domain')}
          >
            Custom Domain
          </SectionSidebarButton>
          <SectionSidebarButton
            active={activeTab === 'rate-limiting'}
            onClick={() => setActiveTab('rate-limiting')}
          >
            Rate Limiting
          </SectionSidebarButton>
        </SectionSidebarGroup>
      </SectionSidebarNav>
    </FeatureSidebar>
  );
}

function SignInMethodsSettings() {
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, error } = useGetSignInMethodsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading sign-in method settings...
      </Spinner>
    );
  }

  return (
    <div className="space-y-8">
      <EmailAndPasswordSettings />
      <MagicLinkSettings />
      <WebAuthnSettings />
      <AnonymousSignInSettings />
      <SMSSettings />
      <OTPEmailSettings />
      <AppleProviderSettings />
      <AzureADProviderSettings />
      <EntraIDProviderSettings />
      <DiscordProviderSettings />
      <FacebookProviderSettings />
      <GitHubProviderSettings />
      <GoogleProviderSettings />
      <LinkedInProviderSettings />
      <SpotifyProviderSettings />
      <TwitchProviderSettings />
      <TwitterProviderSettings />
      <WindowsLiveProviderSettings />
      <WorkOsProviderSettings />
    </div>
  );
}

function OAuth2ProviderSettingsSection() {
  const isPlatform = useIsPlatform();
  const { project, loading: loadingProject } = useProject();
  const localMimirClient = useLocalMimirClient();
  const { auth, loading: loadingVersions } = useSoftwareVersionsInfo();
  const router = useRouter();

  const { data, error } = useGetOAuth2ProviderSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading =
    loadingProject || !project?.id || !data || (isPlatform && loadingVersions);

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading...
      </Spinner>
    );
  }

  if (
    isPlatform &&
    !isVersionGte(auth.configuredVersion, MIN_AUTH_VERSION_OAUTH2)
  ) {
    return (
      <SettingsCard>
        <SettingsCardHeader
          title="Auth Version Too Old"
          description={`OAuth2 Provider settings require Auth version ${MIN_AUTH_VERSION_OAUTH2} or later. Please upgrade your Auth service in the Settings page.`}
        />
        <SettingsCardContent>
          <Button
            className="justify-self-start"
            onClick={() =>
              router.push(
                `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/auth/settings?tab=authentication`,
              )
            }
          >
            Go to Auth Settings
          </Button>
        </SettingsCardContent>
      </SettingsCard>
    );
  }

  return <OAuth2ProviderSettings />;
}

function SMTPSettingsSection() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const [mode, setMode] = useState('postmark');

  const { data, loading, error } = useGetSmtpSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { host } = data?.config?.provider?.smtp || {};

  useEffect(() => {
    setMode(host !== 'postmark' ? 'smtp' : 'postmark');
  }, [host]);

  if (loading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading SMTP settings...
      </Spinner>
    );
  }

  if (isPlatform && org?.plan?.isFree) {
    return (
      <div className="grid grid-flow-row gap-6">
        <UpgradeToProBanner
          section="settings-smtp"
          title="To unlock custom SMTP, transfer this project to a Pro or Team organization."
          description=""
        />
      </div>
    );
  }

  if (error) {
    throw error;
  }

  return (
    <div className="grid grid-flow-row gap-4">
      <Select value={mode} onValueChange={setMode}>
        <SelectTrigger aria-label="SMTP provider">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[10000]">
          <SelectItem value="smtp">SMTP</SelectItem>
          <SelectItem value="postmark">Postmark</SelectItem>
        </SelectContent>
      </Select>

      {mode === 'postmark' ? <PostmarkSettings /> : <SMTPSettings />}
      <DeleteSMTPSettings />
    </div>
  );
}

function AuthenticationSettings() {
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading authentication settings...
      </Spinner>
    );
  }

  return (
    <div className="grid grid-flow-row gap-y-6">
      <AuthServiceVersionSettings />
      <ClientURLSettings />
      <AllowedRedirectURLsSettings />
      <AllowedEmailSettings />
      <BlockedEmailSettings />
      <MFASettings />
      <SessionSettings />
      <GravatarSettings />
      <UserCreationSettings />
      <ConcealErrorsSettings />
    </div>
  );
}

function RolesAndPermissionsSettings() {
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, error } = useGetRolesPermissionsQuery({
    variables: {
      appId: project?.id,
    },
    fetchPolicy: 'cache-and-network',
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading roles and permission variables...
      </Spinner>
    );
  }

  return (
    <div className="grid grid-flow-row gap-6">
      <RoleSettings />
      <PermissionVariableSettings />
    </div>
  );
}

function JWTSettingsSection() {
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, error } = useGetJwtSecretsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading JWT settings...
      </Spinner>
    );
  }

  return <JWTSettings />;
}

function AuthCustomDomainSettings() {
  const { org } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const shouldShowUpgrade = isPlatform && !!org?.plan?.isFree;

  const { data, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    skip: shouldShowUpgrade || !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (shouldShowUpgrade) {
    return (
      <UpgradeToProBanner
        section="settings-custom-domains"
        title="To unlock Custom Domains, transfer this project to a Pro or Team organization."
        description=""
      />
    );
  }

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading Auth custom domain settings...
      </Spinner>
    );
  }

  return <AuthDomain />;
}

function AuthRateLimitingSettings() {
  const { project, loading: loadingProject } = useProject();
  const { loading } = useGetRateLimits();

  if (loadingProject || !project?.id || loading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading Auth rate limit settings...
      </Spinner>
    );
  }

  return <AuthLimitingForm />;
}

function AuthSettingsContent() {
  const { activeTab } = useAuthSettingsTab();

  if (activeTab === 'sign-in-methods') {
    return <SignInMethodsSettings />;
  }

  if (activeTab === 'oauth2-provider') {
    return <OAuth2ProviderSettingsSection />;
  }

  if (activeTab === 'smtp') {
    return <SMTPSettingsSection />;
  }

  if (activeTab === 'authentication') {
    return <AuthenticationSettings />;
  }

  if (activeTab === 'roles-and-permissions') {
    return <RolesAndPermissionsSettings />;
  }

  if (activeTab === 'jwt') {
    return <JWTSettingsSection />;
  }

  if (activeTab === 'custom-domain') {
    return <AuthCustomDomainSettings />;
  }

  return <AuthRateLimitingSettings />;
}

export default function AuthSettingsPage() {
  return (
    <SettingsLayout>
      <div className="w-full px-5 py-4">
        <AuthSettingsContent />
      </div>
    </SettingsLayout>
  );
}

AuthSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return getAuthLayout(page, {
    sidebar: <AuthSettingsSidebar />,
    bodyClassName: 'self-center w-full max-w-[1000px]',
    contentClassName: 'flex flex-col',
  });
};
