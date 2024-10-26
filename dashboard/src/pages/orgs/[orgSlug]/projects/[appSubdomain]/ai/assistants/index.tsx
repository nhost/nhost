/* eslint-disable import/extensions */
import { useDialog } from '@/components/common/DialogProvider';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';

import {
  useGetAssistantsQuery,
  type GetAssistantsQuery,
} from '@/utils/__generated__/graphite.graphql';
import { useMemo, type ReactElement } from 'react';

import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { AISidebar } from '@/features/orgs/layout/AISidebar';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { AssistantForm } from '@/features/orgs/projects/ai/AssistantForm';
import { AssistantsList } from '@/features/orgs/projects/ai/AssistantsList';
import { useIsGraphiteEnabled } from '@/features/orgs/projects/common/hooks/useIsGraphiteEnabled';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAdminApolloClient } from '@/features/orgs/projects/hooks/useAdminApolloClient';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export type Assistant = Omit<
  GetAssistantsQuery['graphite']['assistants'][0],
  '__typename'
>;

export default function AssistantsPage() {
  const { openDrawer } = useDialog();
  const isPlatform = useIsPlatform();

  const { org, loading: loadingOrg } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();

  const { adminClient } = useAdminApolloClient();
  const { isGraphiteEnabled, loading: loadingGraphite } =
    useIsGraphiteEnabled();

  const {
    data,
    loading: loadingAssistants,
    refetch,
  } = useGetAssistantsQuery({
    client: adminClient,
  });

  const assistants = useMemo(() => data?.graphite?.assistants || [], [data]);

  const openCreateAssistantForm = () => {
    openDrawer({
      title: 'Create a new Assistant',
      component: <AssistantForm onSubmit={refetch} />,
    });
  };

  if (loadingOrg || loadingProject || loadingGraphite || loadingAssistants) {
    return (
      <Box className="flex items-center justify-center w-full h-full">
        <ActivityIndicator
          delay={1000}
          label="Loading Assistants..."
          className="justify-center"
        />
      </Box>
    );
  }

  if (isPlatform && org?.plan?.isFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          title="To unlock Nhost Assistants, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
    );
  }

  if (
    (isPlatform && !org?.plan?.isFree && !project.config?.ai) ||
    !isGraphiteEnabled
  ) {
    return (
      <Box
        className="w-full p-4"
        sx={{ backgroundColor: 'background.default' }}
      >
        <Alert className="grid items-center w-full grid-flow-col gap-2 place-content-between">
          <Text className="grid grid-flow-row justify-items-start gap-0.5">
            <Text component="span">
              To enable graphite, configure the service first in{' '}
              <Link
                href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/ai`}
                rel="noopener noreferrer"
                underline="hover"
              >
                AI Settings
              </Link>
              .
            </Text>
          </Text>
        </Alert>
      </Box>
    );
  }

  if (data?.graphite?.assistants.length === 0 && !loadingAssistants) {
    return (
      <Box
        className="w-full p-6"
        sx={{ backgroundColor: 'background.default' }}
      >
        <Box className="flex flex-col items-center justify-center px-48 py-12 space-y-5 border rounded-lg shadow-sm">
          <span className="text-6xl">🤖</span>
          <div className="flex flex-col space-y-1">
            <Text className="font-medium text-center" variant="h3">
              No Assistants are configured
            </Text>
            <Text variant="subtitle1" className="text-center">
              All your assistants will be listed here.
            </Text>
          </div>
          <div className="flex flex-row rounded-lg place-content-between">
            <Button
              variant="contained"
              color="primary"
              className="w-full"
              onClick={openCreateAssistantForm}
              startIcon={<PlusIcon className="w-4 h-4" />}
            >
              Create a new assistant
            </Button>
          </div>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="flex flex-col w-full overflow-hidden">
      <Box className="flex flex-row p-4 place-content-end border-b-1">
        <Button
          variant="contained"
          color="primary"
          onClick={openCreateAssistantForm}
          startIcon={<PlusIcon className="w-4 h-4" />}
        >
          New
        </Button>
      </Box>
      <div>
        <AssistantsList
          assistants={assistants}
          onDelete={() => refetch()}
          onCreateOrUpdate={() => refetch()}
        />
      </div>
    </Box>
  );
}

AssistantsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{ className: 'flex flex-row w-full h-full' }}
    >
      <AISidebar className="w-full max-w-sidebar" />
      <RetryableErrorBoundary>{page}</RetryableErrorBoundary>
    </ProjectLayout>
  );
};
