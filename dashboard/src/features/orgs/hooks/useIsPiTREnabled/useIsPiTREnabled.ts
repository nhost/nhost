import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetPostgresSettingsQuery } from '@/generated/graphql';
import { isNotEmptyValue as isNotNull } from '@/lib/utils';

function useIsPiTREnabled() {
  const { project } = useProject();
  const { data, loading } = useGetPostgresSettingsQuery({
    variables: { appId: project?.id },
  });

  const isPiTREnabled = isNotNull(data?.config?.postgres.pitr);

  return { isPiTREnabled, loading };
}

export default useIsPiTREnabled;
