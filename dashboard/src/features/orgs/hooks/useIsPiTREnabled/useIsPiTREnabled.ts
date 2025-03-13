import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue as isNotNull } from '@/lib/utils';
import { useGetPostgresSettingsQuery } from '@/utils/__generated__/graphql';
import { useMemo } from 'react';

function useIsPiTREnabled() {
  const { project } = useProject();
  const { data, loading } = useGetPostgresSettingsQuery({
    variables: { appId: project?.id },
  });

  const isPiTREnabled = useMemo(
    () => isNotNull(data?.config.postgres.pitr?.retention),
    [data?.config.postgres.pitr?.retention],
  );

  return { isPiTREnabled, loading };
}

export default useIsPiTREnabled;
