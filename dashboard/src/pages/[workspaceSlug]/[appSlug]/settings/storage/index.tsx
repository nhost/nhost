import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { StorageServiceVersionSettings } from '@/features/storage/settings/components/HasuraServiceVersionSettings';
import { HasuraStorageAVSettings } from '@/features/storage/settings/components/HasuraStorageAVSettings';
import { useGetStorageSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function StorageSettingsPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { loading, error } = useGetStorageSettingsQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject,
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Storage settings..."
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
      <StorageServiceVersionSettings />
      <HasuraStorageAVSettings />
    </Container>
  );
}

StorageSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
