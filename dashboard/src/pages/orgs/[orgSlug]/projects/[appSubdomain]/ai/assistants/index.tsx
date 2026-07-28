import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { type ReactElement, useMemo } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { AISidebar } from '@/features/orgs/layout/AISidebar';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { AssistantForm } from '@/features/orgs/projects/ai/AssistantForm';
import { AssistantsList } from '@/features/orgs/projects/ai/AssistantsList';
import { useIsFileStoreSupported } from '@/features/orgs/projects/common/hooks/useIsFileStoreSupported';
import { useIsGraphiteEnabled } from '@/features/orgs/projects/common/hooks/useIsGraphiteEnabled';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  type GetAssistantsQuery,
  useGetAssistantsQuery,
  useGetGraphiteFileStoresQuery,
} from '@/generated/graphite';

export type Assistant = Omit<
  NonNullable<GetAssistantsQuery['graphite']>['assistants'][number],
  '__typename'
>;

export default function AssistantsPage() {
  const { openDrawer } = useDialog();
  const isPlatform = useIsPlatform();

  const { org, loading: loadingOrg } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();

  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const { isGraphiteEnabled, loading: loadingGraphite } =
    useIsGraphiteEnabled();

  const { isFileStoreSupported, loading: fileStoreLoading } =
    useIsFileStoreSupported();

  const {
    data: assistantsData,
    loading: assistantsLoading,
    error: assistantsError,
    refetch: assistantsRefetch,
  } = useGetAssistantsQuery({
    client: remoteProjectGQLClient,
    variables: {
      isFileStoresSupported: isFileStoreSupported ?? false,
    },
    skip: isFileStoreSupported === null || fileStoreLoading,
  });
  const { data: fileStoresData, error: fileStoresError } =
    useGetGraphiteFileStoresQuery({
      client: remoteProjectGQLClient,
    });

  const assistants = useMemo(
    () => assistantsData?.graphite?.assistants || [],
    [assistantsData],
  );
  const fileStores = useMemo(
    () => fileStoresData?.graphite?.fileStores || [],
    [fileStoresData],
  );

  const openCreateAssistantForm = () => {
    openDrawer({
      title: 'Create a new Assistant',
      component: (
        <AssistantForm
          onSubmit={assistantsRefetch}
          fileStores={isFileStoreSupported ? fileStores : undefined}
        />
      ),
    });
  };

  if (loadingOrg || loadingProject || loadingGraphite || assistantsLoading) {
    return (
      <Box className="flex h-full w-full items-center justify-center">
        <Spinner size="medium" wrapperClassName="gap-2">
          Loading Assistants...
        </Spinner>
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
  const slug = isPlatform ? org?.slug : 'local';

  if (
    (isPlatform && !org?.plan?.isFree && !project?.config?.ai) ||
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
                href={`/orgs/${slug}/projects/${project?.subdomain}/settings/ai`}
                rel="noopener noreferrer"
                className="text-primary hover:underline"
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

  if (assistantsError || fileStoresError) {
    throw assistantsError || fileStoresError;
  }

  if (assistants.length === 0 && !assistantsLoading) {
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
            <Button className="w-full" onClick={openCreateAssistantForm}>
              <PlusIcon className="mr-2 h-4 w-4" />
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
        <Button onClick={openCreateAssistantForm}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New
        </Button>
      </Box>
      <div>
        <AssistantsList
          assistants={assistants}
          fileStores={isFileStoreSupported ? fileStores : undefined}
          onDelete={() => assistantsRefetch()}
          onCreateOrUpdate={() => assistantsRefetch()}
        />
      </div>
    </Box>
  );
}

AssistantsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className:
          'flex flex-row w-full h-full !bg-[#fafafa] dark:!bg-[#151a22]',
      }}
    >
      <AISidebar />
      <div className="w-full overflow-auto">
        <RetryableErrorBoundary>{page}</RetryableErrorBoundary>
      </div>
    </OrgLayout>
  );
};
