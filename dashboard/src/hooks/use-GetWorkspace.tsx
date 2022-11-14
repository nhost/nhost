import { useGetWorkspaceWhereQuery } from '@/utils/__generated__/graphql';

export function useGetWorkspace(workspaceSlug: string | string[] | undefined) {
  const { data, loading, error } = useGetWorkspaceWhereQuery({
    variables: {
      where: {
        slug: {
          _eq: workspaceSlug as string,
        },
      },
    },
    fetchPolicy: 'cache-first',
  });

  return { data, loading, error };
}

export default useGetWorkspace;
