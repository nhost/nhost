import Container from '@/components/layout/Container';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { HasuraServiceVersionSettings } from '@/features/projects/settings/hasura/components/HasuraServiceVersionSettings';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { useGetHasuraSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function SettingsAuthenticationPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-and-network',
  });

  if (loading) {
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
    </Container>
  );
}

SettingsAuthenticationPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
