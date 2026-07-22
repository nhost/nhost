import type { ReactElement } from 'react';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { AllowedEmailSettings } from '@/features/orgs/projects/authentication/settings/components/AllowedEmailSettings';
import { AllowedRedirectURLsSettings } from '@/features/orgs/projects/authentication/settings/components/AllowedRedirectURLsSettings';
import { AuthServiceVersionSettings } from '@/features/orgs/projects/authentication/settings/components/AuthServiceVersionSettings';
import { BlockedEmailSettings } from '@/features/orgs/projects/authentication/settings/components/BlockedEmailSettings';
import { ClientURLSettings } from '@/features/orgs/projects/authentication/settings/components/ClientURLSettings';
import { ConcealErrorsSettings } from '@/features/orgs/projects/authentication/settings/components/ConcealErrorsSettings';
import { GravatarSettings } from '@/features/orgs/projects/authentication/settings/components/GravatarSettings';
import { MFASettings } from '@/features/orgs/projects/authentication/settings/components/MFASettings';
import { SessionSettings } from '@/features/orgs/projects/authentication/settings/components/SessionSettings';
import { UserCreationSettings } from '@/features/orgs/projects/authentication/settings/components/UserCreationSettings';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetAuthenticationSettingsQuery } from '@/generated/graphql';

export default function SettingsAuthenticationPage() {
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

SettingsAuthenticationPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout>
      <SettingsLayout>
        <div className="mx-auto w-full max-w-5xl px-5 py-4">{page}</div>
      </SettingsLayout>
    </OrgLayout>
  );
};
