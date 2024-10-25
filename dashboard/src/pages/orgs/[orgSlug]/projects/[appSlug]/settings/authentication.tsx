import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';

import { AllowedEmailSettings } from '@/features/orgs/projects/authentication/settings/components/AllowedEmailSettings';
import { AllowedRedirectURLsSettings } from '@/features/orgs/projects/authentication/settings/components/AllowedRedirectURLsSettings';
import { AuthServiceVersionSettings } from '@/features/orgs/projects/authentication/settings/components/AuthServiceVersionSettings';
import { BlockedEmailSettings } from '@/features/orgs/projects/authentication/settings/components/BlockedEmailSettings';
import { ClientURLSettings } from '@/features/orgs/projects/authentication/settings/components/ClientURLSettings';
import { ConcealErrorsSettings } from '@/features/orgs/projects/authentication/settings/components/ConcealErrorsSettings';
import { DisableNewUsersSettings } from '@/features/orgs/projects/authentication/settings/components/DisableNewUsersSettings';
import { GravatarSettings } from '@/features/orgs/projects/authentication/settings/components/GravatarSettings';
import { MFASettings } from '@/features/orgs/projects/authentication/settings/components/MFASettings';
import { SessionSettings } from '@/features/orgs/projects/authentication/settings/components/SessionSettings';
import { useGetAuthenticationSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function SettingsAuthenticationPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    skip: !project,
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
      className="grid max-w-5xl grid-flow-row bg-transparent gap-y-6"
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
  return <SettingsLayout>{page}</SettingsLayout>;
};
