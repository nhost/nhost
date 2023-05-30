import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { AnonymousSignInSettings } from '@/components/settings/signInMethods/AnonymousSignInSettings';
import { AppleProviderSettings } from '@/components/settings/signInMethods/AppleProviderSettings';
import { AzureADProviderSettings } from '@/components/settings/signInMethods/AzureADProviderSettings';
import { DiscordProviderSettings } from '@/components/settings/signInMethods/DiscordProviderSettings';
import { EmailAndPasswordSettings } from '@/components/settings/signInMethods/EmailAndPasswordSettings';
import { FacebookProviderSettings } from '@/components/settings/signInMethods/FacebookProviderSettings';
import { GitHubProviderSettings } from '@/components/settings/signInMethods/GitHubProviderSettings';
import { GoogleProviderSettings } from '@/components/settings/signInMethods/GoogleProviderSettings';
import { LinkedInProviderSettings } from '@/components/settings/signInMethods/LinkedInProviderSettings';
import { MagicLinkSettings } from '@/components/settings/signInMethods/MagicLinkSettings';
import { SMSSettings } from '@/components/settings/signInMethods/SMSSettings';
import { SpotifyProviderSettings } from '@/components/settings/signInMethods/SpotifyProviderSettings';
import { TwitchProviderSettings } from '@/components/settings/signInMethods/TwitchProviderSettings';
import { TwitterProviderSettings } from '@/components/settings/signInMethods/TwitterProviderSettings';
import { WebAuthnSettings } from '@/components/settings/signInMethods/WebAuthnSettings';
import { WindowsLiveProviderSettings } from '@/components/settings/signInMethods/WindowsLiveProviderSettings';
import { WorkOsProviderSettings } from '@/components/settings/signInMethods/WorkOsProviderSettings';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useGetSignInMethodsQuery } from '@/generated/graphql';
import { ActivityIndicator } from '@/ui/v2/ActivityIndicator';
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
