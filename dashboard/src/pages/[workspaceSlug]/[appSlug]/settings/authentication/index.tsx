import Container from '@/components/layout/Container';
import AllowedEmailDomainsSettings from '@/components/settings/authentication/AllowedEmailSettings';
import AllowedRedirectURLsSettings from '@/components/settings/authentication/AllowedRedirectURLsSettings';
import BlockedEmailSettings from '@/components/settings/authentication/BlockedEmailSettings';
import ClientURLSettings from '@/components/settings/authentication/ClientURLSettings';
import DisableNewUsersSettings from '@/components/settings/authentication/DisableNewUsersSettings';
import GravatarSettings from '@/components/settings/authentication/GravatarSettings';
import MFASettings from '@/components/settings/authentication/MFASettings';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { useGetAuthenticationSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function SettingsAuthenticationPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentApplication?.id },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Authentication settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <ClientURLSettings />
      <AllowedRedirectURLsSettings />
      <AllowedEmailDomainsSettings />
      <BlockedEmailSettings />
      <MFASettings />
      <GravatarSettings />
      <DisableNewUsersSettings />
    </Container>
  );
}

SettingsAuthenticationPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
