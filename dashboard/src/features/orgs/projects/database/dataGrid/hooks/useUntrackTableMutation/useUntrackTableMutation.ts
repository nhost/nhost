import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type {
  UntrackTableOptions,
  UntrackTableVariables,
} from './untrackTable';
import untrackTable from './untrackTable';
import untrackTableMigration from './untrackTableMigration';

export interface UseUntrackTableMutationOptions
  extends Partial<UntrackTableOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<void, unknown, UntrackTableVariables>;
}

export default function useUntrackTableMutation({
  dataSource: customDataSource,
  schema: customSchema,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseUntrackTableMutationOptions = {}) {
  const isPlatform = useIsPlatform();
  const {
    query: { dataSourceSlug, schemaSlug },
  } = useRouter();
  const { project } = useProject();

  const mutationFn = isPlatform ? untrackTable : untrackTableMigration;

  const mutation = useMutation((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );

    return mutationFn({
      ...variables,
      appUrl: customAppUrl || appUrl,
      adminSecret:
        process.env.NEXT_PUBLIC_ENV === 'dev'
          ? getHasuraAdminSecret()
          : customAdminSecret || project!.config!.hasura.adminSecret,
      dataSource: customDataSource || (dataSourceSlug as string),
      schema: customSchema || (schemaSlug as string),
    });
  }, mutationOptions);

  return mutation;
}
