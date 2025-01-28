import { useDialog } from '@/components/common/DialogProvider';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { AISidebar } from '@/components/layout/AISidebar';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { AssistantForm } from '@/features/ai/AssistantForm';
import { AssistantsList } from '@/features/ai/AssistantsList';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useAdminApolloClient } from '@/features/projects/common/hooks/useAdminApolloClient';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsGraphiteEnabled } from '@/features/projects/common/hooks/useIsGraphiteEnabled';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  useGetAssistantsQuery,
  type GetAssistantsQuery,
} from '@/utils/__generated__/graphite.graphql';
import { useMemo, type ReactElement } from 'react';

export type Assistant = Omit<
  GetAssistantsQuery['graphite']['assistants'][0],
  '__typename'
>;

export default function AssistantsPage() {
  const { openDrawer } = useDialog();
  const isPlatform = useIsPlatform();
  const { currentWorkspace, currentProject } = useCurrentWorkspaceAndProject();
  const { adminClient } = useAdminApolloClient();
  const { isGraphiteEnabled } = useIsGraphiteEnabled();

  const { data, loading, refetch } = useGetAssistantsQuery({
    client: adminClient,
  });

  const assistants = useMemo(() => data?.graphite?.assistants || [], [data]);

  const openCreateAssistantForm = () => {
    openDrawer({
      title: 'Create a new Assistant',
      component: <AssistantForm onSubmit={refetch} />,
    });
  };

  if (isPlatform && currentProject?.legacyPlan?.isFree) {
    return (
      <Box
        className="w-full p-4"
        sx={{ backgroundColor: 'background.default' }}
      >
        <UpgradeToProBanner
          title="Upgrade to Nhost Pro."
          description={
            <Text>
              Graphite is an addon to the Pro plan. To unlock it, please upgrade
              to Pro first.
            </Text>
          }
        />
      </Box>
    );
  }

  if (
    (isPlatform &&
      !currentProject?.legacyPlan?.isFree &&
      !currentProject?.config?.ai) ||
    !isGraphiteEnabled
  ) {
    return (
      <Box
        className="w-full p-4"
        sx={{ backgroundColor: 'background.default' }}
      >
        <Alert className="grid w-full grid-flow-col place-content-between items-center gap-2">
          <Text className="grid grid-flow-row justify-items-start gap-0.5">
            <Text component="span">
              To enable graphite, configure the service first in{' '}
              <Link
                href={`/${currentWorkspace?.slug}/${currentProject?.subdomain}/settings/ai`}
                target="_blank"
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

  if (loading) {
    return <Box className="p-4">Loading...</Box>;
  }

  if (assistants.length === 0) {
    return (
      <Box
        className="w-full p-6"
        sx={{ backgroundColor: 'background.default' }}
      >
        <Box className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <span className="text-6xl">🤖</span>
          <div className="flex flex-col space-y-1">
            <Text className="text-center font-medium" variant="h3">
              No Assistants are configured
            </Text>
            <Text variant="subtitle1" className="text-center">
              All your assistants will be listed here.
            </Text>
          </div>
          <div className="flex flex-row place-content-between rounded-lg">
            <Button
              variant="contained"
              color="primary"
              className="w-full"
              onClick={openCreateAssistantForm}
              startIcon={<PlusIcon className="h-4 w-4" />}
            >
              Create a new assistant
            </Button>
          </div>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="flex w-full flex-col overflow-hidden">
      <Box className="flex flex-row place-content-end border-b-1 p-4">
        <Button
          variant="contained"
          color="primary"
          onClick={openCreateAssistantForm}
          startIcon={<PlusIcon className="h-4 w-4" />}
        >
          New
        </Button>
      </Box>
      <AssistantsList
        assistants={assistants}
        onDelete={() => refetch()}
        onCreateOrUpdate={() => refetch()}
      />
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
