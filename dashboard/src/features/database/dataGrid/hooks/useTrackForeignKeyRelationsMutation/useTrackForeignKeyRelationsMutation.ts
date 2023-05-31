import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import type {
  TrackForeignKeyRelationsOptions,
  TrackForeignKeyRelationsVariables,
} from './trackForeignKeyRelations';
import trackForeignKeyRelations from './trackForeignKeyRelations';
import trackForeignKeyRelationsMigration from './trackForeignKeyRelationsMigration';

export interface UseTrackForeignKeyRelationsMutation
  extends Partial<TrackForeignKeyRelationsOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    void,
    unknown,
    TrackForeignKeyRelationsVariables
  >;
}

export default function useTrackForeignKeyRelationMutation({
  dataSource: customDataSource,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseTrackForeignKeyRelationsMutation = {}) {
  const isPlatform = useIsPlatform();
  const {
    query: { dataSourceSlug },
  } = useRouter();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const appUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region,
    'hasura',
  );
  const mutationFn = isPlatform
    ? trackForeignKeyRelations
    : trackForeignKeyRelationsMigration;

  const mutation = useMutation(
    (variables) =>
      mutationFn({
        ...variables,
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : customAdminSecret || currentProject?.config?.hasura.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
      }),
    mutationOptions,
  );

  return mutation;
}
