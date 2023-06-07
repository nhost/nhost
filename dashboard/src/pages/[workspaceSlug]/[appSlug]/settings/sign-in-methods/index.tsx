import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { AnonymousSignInSettings } from '@/features/authentication/settings/components/AnonymousSignInSettings';
import { AppleProviderSettings } from '@/features/authentication/settings/components/AppleProviderSettings';
import { AzureADProviderSettings } from '@/features/authentication/settings/components/AzureADProviderSettings';
import { DiscordProviderSettings } from '@/features/authentication/settings/components/DiscordProviderSettings';
import { EmailAndPasswordSettings } from '@/features/authentication/settings/components/EmailAndPasswordSettings';
import { FacebookProviderSettings } from '@/features/authentication/settings/components/FacebookProviderSettings';
import { GitHubProviderSettings } from '@/features/authentication/settings/components/GitHubProviderSettings';
import { GoogleProviderSettings } from '@/features/authentication/settings/components/GoogleProviderSettings';
import { LinkedInProviderSettings } from '@/features/authentication/settings/components/LinkedInProviderSettings';
import { MagicLinkSettings } from '@/features/authentication/settings/components/MagicLinkSettings';
import { SMSSettings } from '@/features/authentication/settings/components/SMSSettings';
import { SpotifyProviderSettings } from '@/features/authentication/settings/components/SpotifyProviderSettings';
import { TwitchProviderSettings } from '@/features/authentication/settings/components/TwitchProviderSettings';
import { TwitterProviderSettings } from '@/features/authentication/settings/components/TwitterProviderSettings';
import { WebAuthnSettings } from '@/features/authentication/settings/components/WebAuthnSettings';
import { WindowsLiveProviderSettings } from '@/features/authentication/settings/components/WindowsLiveProviderSettings';
import { WorkOsProviderSettings } from '@/features/authentication/settings/components/WorkOsProviderSettings';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useGetSignInMethodsQuery } from '@/generated/graphql';
import type { ReactElement } from 'react';

export default function SettingsSignInMethodsPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { loading, error } = useGetSignInMethodsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'network-only',
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
  return <SettingsLayout>{page}</SettingsLayout>;
};
