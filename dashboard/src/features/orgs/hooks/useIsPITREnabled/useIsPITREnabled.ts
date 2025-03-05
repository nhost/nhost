import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';
import { useGetPostgresSettingsQuery } from '@/utils/__generated__/graphql';
import { useMemo } from 'react';

function useIsPITREnabled() {
  const { project } = useProject();
  const { data, loading } = useGetPostgresSettingsQuery({
    variables: { appId: project?.id },
  });

  const isPITREnabled = useMemo(
    () => isNotEmptyValue(data?.config.postgres.pitr?.retention),
    [data?.config.postgres.pitr?.retention],
  );

  return { isPITREnabled, loading };
}

export default useIsPITREnabled;
