import Container from '@/components/layout/Container';
import SettingsLayout from '@/components/settings/SettingsLayout';
import AllowedEmailDomainsSettings from '@/components/settings/authentication/AllowedEmailSettings';
import AllowedRedirectURLsSettings from '@/components/settings/authentication/AllowedRedirectURLsSettings';
import BlockedEmailSettings from '@/components/settings/authentication/BlockedEmailSettings';
import ClientURLSettings from '@/components/settings/authentication/ClientURLSettings';
import DisableNewUsersSettings from '@/components/settings/authentication/DisableNewUsersSettings';
import GravatarSettings from '@/components/settings/authentication/GravatarSettings';
import MFASettings from '@/components/settings/authentication/MFASettings';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { useGetAppQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function SettingsAuthenticationPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { loading, error } = useGetAppQuery({
    variables: {
      id: currentApplication?.id,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Authentication Settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row bg-transparent gap-y-6"
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
