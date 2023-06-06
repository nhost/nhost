import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { AllowedEmailSettings } from '@/features/authentication/settings/components/AllowedEmailSettings';
import { AllowedRedirectURLsSettings } from '@/features/authentication/settings/components/AllowedRedirectURLsSettings';
import { AuthServiceVersionSettings } from '@/features/authentication/settings/components/AuthServiceVersionSettings';
import { BlockedEmailSettings } from '@/features/authentication/settings/components/BlockedEmailSettings';
import { ClientURLSettings } from '@/features/authentication/settings/components/ClientURLSettings';
import { DisableNewUsersSettings } from '@/features/authentication/settings/components/DisableNewUsersSettings';
import { GravatarSettings } from '@/features/authentication/settings/components/GravatarSettings';
import { MFASettings } from '@/features/authentication/settings/components/MFASettings';
import { SessionSettings } from '@/features/authentication/settings/components/SessionSettings';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useGetAuthenticationSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function SettingsAuthenticationPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject,
  });

  if (!data && loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading authentication settings..."
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
      <SessionSettings />
      <GravatarSettings />
      <DisableNewUsersSettings />
    </Container>
  );
}

SettingsAuthenticationPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
