import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
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

  const adminApi = useAdminApiTarget();

  const mutationFn = isPlatform
    ? trackForeignKeyRelations
    : trackForeignKeyRelationsMigration;

  const mutation = useMutation((variables) => {
    const appUrl = adminApi!.appUrl;

    return mutationFn({
      ...variables,
      appUrl: customAppUrl || appUrl,
      adminSecret: customAdminSecret || adminApi!.adminSecret,
      dataSource: customDataSource || (dataSourceSlug as string),
    });
  }, mutationOptions);

  return mutation;
}
