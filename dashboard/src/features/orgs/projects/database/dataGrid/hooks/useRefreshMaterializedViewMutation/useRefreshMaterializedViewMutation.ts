import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
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
  const { project } = useProject();

  const mutation = useMutation(
    async (variables: RefreshMaterializedViewVariables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return refreshMaterializedView({
        ...variables,
        appUrl: customAppUrl || appUrl,
        adminSecret: customAdminSecret || project!.config!.hasura.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
      });
    },
    mutationOptions,
  );

  return mutation;
}
