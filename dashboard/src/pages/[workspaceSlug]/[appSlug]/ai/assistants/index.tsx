import { useDialog } from '@/components/common/DialogProvider';
import AILayout from '@/components/layout/AILayout/AILayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Text } from '@/components/ui/v2/Text';
import { AssistantForm } from '@/features/ai/AssistantForm';
import { AssistantsList } from '@/features/ai/AssistantsList';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import {
  useGetAssistantsQuery,
  type GetAssistantsQuery,
} from '@/utils/__generated__/graphite.graphql';
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { useMemo, type ReactElement } from 'react';

export type Assistant = Omit<
  GetAssistantsQuery['graphite']['assistants'][0],
  '__typename'
>;

export default function AssistantsPage() {
  const { openDrawer } = useDialog();

  const { currentProject } = useCurrentWorkspaceAndProject();
  const adminSecret = currentProject?.config?.hasura?.adminSecret;

  const serviceUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region,
    'graphql',
  );

  const client = useMemo(
    () =>
      new ApolloClient({
        cache: new InMemoryCache(),
        link: new HttpLink({
          uri: serviceUrl,
          headers: {
            'x-hasura-admin-secret':
              process.env.NEXT_PUBLIC_ENV === 'dev'
                ? getHasuraAdminSecret()
                : adminSecret,
          },
        }),
      }),
    [serviceUrl, adminSecret],
  );

  const { data, loading, refetch } = useGetAssistantsQuery({ client });

  const assistants = useMemo(() => data?.graphite?.assistants || [], [data]);

  const openCreateAssistantForm = () => {
    openDrawer({
      title: 'Create a new Assistant',
      component: <AssistantForm onSubmit={refetch} />,
    });
  };

  if (data?.graphite?.assistants.length === 0 && !loading) {
    return (
      <Box className="p-6" sx={{ backgroundColor: 'background.default' }}>
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
          <div className="flex flex-row rounded-lg place-content-between ">
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
    <Box className="flex flex-col overflow-hidden">
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
  return <AILayout>{page}</AILayout>;
};
