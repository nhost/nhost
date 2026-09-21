import { useRouter } from 'next/router';
import {
  type ComponentType,
  type ReactElement,
  useEffect,
  useState,
} from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
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
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { AuthArea } from '@/features/orgs/projects/authentication/layout';
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
import { CustomDomainsNotice } from '@/features/orgs/projects/custom-domains/settings/components/CustomDomainsNotice';
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

function OAuth2ProviderSettingsTab() {
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

function SMTPSettingsTab() {
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

function JWTSettingsTab() {
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

  return (
    <div className="grid grid-flow-row gap-6">
      <CustomDomainsNotice />
      <AuthDomain />
    </div>
  );
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

interface AuthSettingsTab {
  slug: string;
  label: string;
  Content: ComponentType;
  platformOnly?: boolean;
}

interface AuthSettingsGroup {
  label: string;
  tabs: readonly AuthSettingsTab[];
}

const AUTH_SETTINGS_GROUPS: readonly AuthSettingsGroup[] = [
  {
    label: 'Sign-in',
    tabs: [
      {
        slug: 'sign-in-methods',
        label: 'Sign-In Methods',
        Content: SignInMethodsSettings,
      },
      {
        slug: 'oauth2-provider',
        label: 'OAuth2 Provider',
        Content: OAuth2ProviderSettingsTab,
      },
      { slug: 'smtp', label: 'SMTP', Content: SMTPSettingsTab },
    ],
  },
  {
    label: 'Users and access',
    tabs: [
      {
        slug: 'authentication',
        label: 'Authentication',
        Content: AuthenticationSettings,
      },
      {
        slug: 'roles-and-permissions',
        label: 'Roles and Permissions',
        Content: RolesAndPermissionsSettings,
      },
      { slug: 'jwt', label: 'JWT', Content: JWTSettingsTab },
    ],
  },
  {
    label: 'Connectivity',
    tabs: [
      {
        slug: 'custom-domain',
        label: 'Custom Domain',
        Content: AuthCustomDomainSettings,
        platformOnly: true,
      },
      {
        slug: 'rate-limiting',
        label: 'Rate Limiting',
        Content: AuthRateLimitingSettings,
      },
    ],
  },
];

const DEFAULT_TAB = AUTH_SETTINGS_GROUPS[0].tabs[0];

/**
 * The active tab lives in `?tab=`; an unknown value, or a platform-only one
 * on self-hosted, falls back to the first tab.
 */
function useAuthSettingsTabs() {
  const router = useRouter();
  const isPlatform = useIsPlatform();

  const groups = AUTH_SETTINGS_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => isPlatform || !tab.platformOnly),
  })).filter((group) => group.tabs.length > 0);

  const requested = getSingleQueryParam(router.query.tab);
  const activeTab =
    groups
      .flatMap((group) => group.tabs)
      .find((tab) => tab.slug === requested) ?? DEFAULT_TAB;

  function hrefFor(tab: AuthSettingsTab) {
    const { tab: _tab, ...query } = router.query;

    return {
      pathname: router.pathname,
      query:
        tab.slug === DEFAULT_TAB.slug ? query : { ...query, tab: tab.slug },
    };
  }

  return { groups, activeTab, hrefFor };
}

function AuthSettingsSidebar() {
  const { groups, activeTab, hrefFor } = useAuthSettingsTabs();

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Auth settings navigation">
        {groups.map((group) => (
          <AreaSidebarGroup key={group.label} label={group.label}>
            {group.tabs.map((tab) => (
              <AreaSidebarLink
                key={tab.slug}
                href={hrefFor(tab)}
                active={tab.slug === activeTab.slug}
                shallow
                scroll={false}
              >
                {tab.label}
              </AreaSidebarLink>
            ))}
          </AreaSidebarGroup>
        ))}
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

export default function AuthSettingsPage() {
  const { activeTab } = useAuthSettingsTabs();

  return (
    <SettingsLayout>
      <activeTab.Content />
    </SettingsLayout>
  );
}

AuthSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <AuthArea>
          <div className="mx-auto flex h-full w-full max-w-6xl">
            <AuthSettingsSidebar />
            <div className="min-w-0 flex-1">{page}</div>
          </div>
        </AuthArea>
      </ProjectScope>
    </AppLayout>
  );
};
