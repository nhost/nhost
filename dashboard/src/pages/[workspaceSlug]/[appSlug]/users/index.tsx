import { useDialog } from '@/components/common/DialogProvider';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import UsersBody from '@/components/users/UsersBody';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import Button from '@/ui/v2/Button';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import UserIcon from '@/ui/v2/icons/UserIcon';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { generateAppServiceUrl } from '@/utils/helpers';
import { useTotalUsersQuery } from '@/utils/__generated__/graphql';
import { NhostApolloProvider } from '@nhost/react-apollo';
import type { ReactElement } from 'react';

export default function UsersPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openDialog } = useDialog();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const { data, loading } = useTotalUsersQuery({
    client: remoteProjectGQLClient,
  });

  if (!currentApplication || loading) {
    return <LoadingScreen />;
  }

  function handleCreateUser() {
    openDialog('CREATE_USER', {
      title: 'Create User',
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  if (data.usersAggregate.aggregate.count === 0) {
    return (
      <Container>
        <div className="flex flex-row place-content-between">
          <Input className="rounded-sm" placeholder="Search users" />
          <Button
            onClick={handleCreateUser}
            startIcon={<PlusIcon className="w-4 h-4" />}
            className="grid h-full grid-flow-col gap-1 p-2 place-items-center"
            size="small"
          >
            Create User
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center px-48 py-12 space-y-5 border rounded-lg shadow-sm border-veryLightGray">
          <UserIcon strokeWidth={1} className="w-10 h-10 text-greyscaleDark" />
          <div className="flex flex-col space-y-1">
            <Text className="font-medium text-center" variant="h3">
              You dont have any users yet.
            </Text>
            <Text variant="subtitle1" className="text-center">
              All users for your project will be listed here.
            </Text>
          </div>
          <div className="flex flex-row place-content-between rounded-lg lg:w-[230px]">
            <Button
              variant="contained"
              color="primary"
              className="w-full"
              aria-label="Create User"
              onClick={handleCreateUser}
            >
              Create User
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <NhostApolloProvider
      graphqlUrl={`${generateAppServiceUrl(
        currentApplication.subdomain,
        currentApplication.region.awsName,
        'graphql',
      )}/v1`}
      fetchPolicy="cache-first"
      headers={{
        'x-hasura-admin-secret':
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? 'nhost-admin-secret'
            : currentApplication.hasuraGraphqlAdminSecret,
      }}
    >
      <Container>
        <div className="flex flex-row place-content-between">
          <Input className="rounded-sm" placeholder="Search users" />
          <Button
            onClick={handleCreateUser}
            startIcon={<PlusIcon className="w-4 h-4" />}
            className="grid h-full grid-flow-col gap-1 p-2 place-items-center"
            size="small"
          >
            Create User
          </Button>
        </div>
        <UsersBody />
      </Container>
    </NhostApolloProvider>
  );
}

UsersPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
