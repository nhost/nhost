import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { HasuraAllowListSettings } from '@/features/hasura/settings/components/HasuraAllowListSettings';
import { HasuraConsoleSettings } from '@/features/hasura/settings/components/HasuraConsoleSettings';
import { HasuraCorsDomainSettings } from '@/features/hasura/settings/components/HasuraCorsDomainSettings';
import { HasuraDevModeSettings } from '@/features/hasura/settings/components/HasuraDevModeSettings';
import { HasuraEnabledAPISettings } from '@/features/hasura/settings/components/HasuraEnabledAPISettings';
import { HasuraLogLevelSettings } from '@/features/hasura/settings/components/HasuraLogLevelSettings';
import { HasuraPoolSizeSettings } from '@/features/hasura/settings/components/HasuraPoolSizeSettings';
import { HasuraRemoteSchemaPermissionsSettings } from '@/features/hasura/settings/components/HasuraRemoteSchemaPermissionsSettings';
import { HasuraServiceVersionSettings } from '@/features/hasura/settings/components/HasuraServiceVersionSettings';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useGetHasuraSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function HasuraSettingsPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject,
  });

  if (!data && loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Hasura settings..."
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
      <HasuraServiceVersionSettings />
      <HasuraLogLevelSettings />
      <HasuraEnabledAPISettings />
      <HasuraPoolSizeSettings />
      <HasuraCorsDomainSettings />
      <HasuraConsoleSettings />
      <HasuraDevModeSettings />
      <HasuraAllowListSettings />
      <HasuraRemoteSchemaPermissionsSettings />
    </Container>
  );
}

HasuraSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
