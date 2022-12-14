import { LoadingScreen } from '@/components/common/LoadingScreen';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import UsersList from '@/components/users/UsersList';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { NhostApolloProvider } from '@nhost/react-apollo';
import type { ReactElement } from 'react';

export default function UsersPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  if (!currentApplication) {
    return <LoadingScreen />;
  }

  return (
    <NhostApolloProvider
      graphqlUrl={generateAppServiceUrl(
        currentApplication.subdomain,
        currentApplication.region.awsName,
        'graphql',
      )}
      fetchPolicy="cache-first"
      headers={{
        'x-hasura-admin-secret':
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? 'nhost-admin-secret'
            : currentApplication.hasuraGraphqlAdminSecret,
      }}
    >
      <Container>
        <UsersList />
      </Container>
    </NhostApolloProvider>
  );
}

UsersPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
