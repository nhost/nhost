import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { AnonymousSignInSettings } from '@/features/orgs/projects/authentication/settings/components/AnonymousSignInSettings';
import { AppleProviderSettings } from '@/features/orgs/projects/authentication/settings/components/AppleProviderSettings';
import { AzureADProviderSettings } from '@/features/orgs/projects/authentication/settings/components/AzureADProviderSettings';
import { DiscordProviderSettings } from '@/features/orgs/projects/authentication/settings/components/DiscordProviderSettings';
import { EmailAndPasswordSettings } from '@/features/orgs/projects/authentication/settings/components/EmailAndPasswordSettings';
import { FacebookProviderSettings } from '@/features/orgs/projects/authentication/settings/components/FacebookProviderSettings';
import { GitHubProviderSettings } from '@/features/orgs/projects/authentication/settings/components/GitHubProviderSettings';
import { GoogleProviderSettings } from '@/features/orgs/projects/authentication/settings/components/GoogleProviderSettings';
import { LinkedInProviderSettings } from '@/features/orgs/projects/authentication/settings/components/LinkedInProviderSettings';
import { MagicLinkSettings } from '@/features/orgs/projects/authentication/settings/components/MagicLinkSettings';
import { SMSSettings } from '@/features/orgs/projects/authentication/settings/components/SMSSettings';
import { SpotifyProviderSettings } from '@/features/orgs/projects/authentication/settings/components/SpotifyProviderSettings';
import { TwitchProviderSettings } from '@/features/orgs/projects/authentication/settings/components/TwitchProviderSettings';
import { TwitterProviderSettings } from '@/features/orgs/projects/authentication/settings/components/TwitterProviderSettings';
import { WebAuthnSettings } from '@/features/orgs/projects/authentication/settings/components/WebAuthnSettings';
import { WindowsLiveProviderSettings } from '@/features/orgs/projects/authentication/settings/components/WindowsLiveProviderSettings';
import { WorkOsProviderSettings } from '@/features/orgs/projects/authentication/settings/components/WorkOsProviderSettings';
import { useGetSignInMethodsQuery } from '@/generated/graphql';
import type { ReactElement } from 'react';

import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { OTPEmailSettings } from '@/features/orgs/projects/authentication/settings/OTPEmailSettings';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function SettingsSignInMethodsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { loading, error } = useGetSignInMethodsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading sign-in method settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <Container
      className="max-w-5xl space-y-8 bg-transparent"
      rootClassName="bg-transparent"
    >
      <EmailAndPasswordSettings />
      <MagicLinkSettings />
      <WebAuthnSettings />
      <AnonymousSignInSettings />
      <SMSSettings />
      <OTPEmailSettings />
      <AppleProviderSettings />
      <AzureADProviderSettings />
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
    </Container>
  );
}

SettingsSignInMethodsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'flex h-full overflow-auto',
      }}
    >
      <SettingsLayout>
        <Container
          sx={{ backgroundColor: 'background.default' }}
          className="max-w-5xl"
        >
          {page}
        </Container>
      </SettingsLayout>
    </ProjectLayout>
  );
};
