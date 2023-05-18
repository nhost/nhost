import Container from '@/components/layout/Container';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { AllowedEmailSettings } from '@/features/projects/authentication/settings/components/AllowedEmailSettings';
import { AllowedRedirectURLsSettings } from '@/features/projects/authentication/settings/components/AllowedRedirectURLsSettings';
import { AuthServiceVersionSettings } from '@/features/projects/authentication/settings/components/AuthServiceVersionSettings';
import { BlockedEmailSettings } from '@/features/projects/authentication/settings/components/BlockedEmailSettings';
import { ClientURLSettings } from '@/features/projects/authentication/settings/components/ClientURLSettings';
import { DisableNewUsersSettings } from '@/features/projects/authentication/settings/components/DisableNewUsersSettings';
import { GravatarSettings } from '@/features/projects/authentication/settings/components/GravatarSettings';
import { MFASettings } from '@/features/projects/authentication/settings/components/MFASettings';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { ActivityIndicator } from '@/ui/v2/ActivityIndicator';
import { useGetAuthenticationSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function SettingsAuthenticationPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject,
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
      <AuthServiceVersionSettings />
      <ClientURLSettings />
      <AllowedRedirectURLsSettings />
      <AllowedEmailSettings />
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
