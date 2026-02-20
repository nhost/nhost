import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type { TrackTableOptions, TrackTableVariables } from './trackTable';
import trackTable from './trackTable';
import trackTableMigration from './trackTableMigration';

export interface UseTrackTableMutationOptions
  extends Partial<TrackTableOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<void, unknown, TrackTableVariables>;
}

/**
 * This hook is a wrapper around a fetch call that tracks a table.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useTrackTableMutation({
  dataSource: customDataSource,
  schema: customSchema,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseTrackTableMutationOptions = {}) {
  const isPlatform = useIsPlatform();
  const {
    query: { dataSourceSlug, schemaSlug },
  } = useRouter();
  const { project } = useProject();

  const queryClient = useQueryClient();
  const mutationFn = isPlatform ? trackTable : trackTableMigration;

  const mutation = useMutation(
    (variables) => {
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
    },
    {
      ...mutationOptions,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
      },
    },
  );

  return mutation;
}
