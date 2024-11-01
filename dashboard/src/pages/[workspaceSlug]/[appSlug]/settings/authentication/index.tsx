import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { AllowedEmailSettings } from '@/features/authentication/settings/components/AllowedEmailSettings';
import { AllowedRedirectURLsSettings } from '@/features/authentication/settings/components/AllowedRedirectURLsSettings';
import { AuthServiceVersionSettings } from '@/features/authentication/settings/components/AuthServiceVersionSettings';
import { BlockedEmailSettings } from '@/features/authentication/settings/components/BlockedEmailSettings';
import { ClientURLSettings } from '@/features/authentication/settings/components/ClientURLSettings';
import { ConcealErrorsSettings } from '@/features/authentication/settings/components/ConcealErrorsSettings';
import { DisableNewUsersSettings } from '@/features/authentication/settings/components/DisableNewUsersSettings';
import { GravatarSettings } from '@/features/authentication/settings/components/GravatarSettings';
import { MFASettings } from '@/features/authentication/settings/components/MFASettings';
import { SessionSettings } from '@/features/authentication/settings/components/SessionSettings';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { useGetAuthenticationSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function SettingsAuthenticationPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject,
    ...(!isPlatform ? { client: localMimirClient } : {}),
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
      <ConcealErrorsSettings />
    </Container>
  );
}

SettingsAuthenticationPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <SettingsLayout>
        <Container sx={{ backgroundColor: 'background.default' }}>
          {page}
        </Container>
      </SettingsLayout>
    </ProjectLayout>
  );
};
