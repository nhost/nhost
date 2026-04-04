import {useRemoteApplicationGQLClient}from '@/features/orgs/hooks/useRemoteApplicationGQLClient';

export default function useAdminApolloClient() {
  const adminClient = useRemoteApplicationGQLClient();

  return {
    adminClient,
  };
}
