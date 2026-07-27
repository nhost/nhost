import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useHasuraApiTarget } from '@/features/orgs/projects/common/hooks/useHasuraApiTarget';
import type {
  RefreshMaterializedViewOptions,
  RefreshMaterializedViewVariables,
} from './refreshMaterializedView';
import refreshMaterializedView from './refreshMaterializedView';

export interface UseRefreshMaterializedViewMutationOptions
  extends Partial<RefreshMaterializedViewOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    void,
    unknown,
    RefreshMaterializedViewVariables
  >;
}

export default function useRefreshMaterializedViewMutation({
  dataSource: customDataSource,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseRefreshMaterializedViewMutationOptions = {}) {
  const {
    query: { dataSourceSlug },
  } = useRouter();
  const hasuraApi = useHasuraApiTarget();

  const mutation = useMutation(
    async (variables: RefreshMaterializedViewVariables) => {
      const appUrl = hasuraApi!.appUrl;

      return refreshMaterializedView({
        ...variables,
        appUrl: customAppUrl || appUrl,
        adminSecret: customAdminSecret || hasuraApi!.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
      });
    },
    mutationOptions,
  );

  return mutation;
}
