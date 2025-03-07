import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';
import { useGetPostgresSettingsQuery } from '@/utils/__generated__/graphql';

function useIsPITREnabled() {
  const { project } = useProject();
  const { data } = useGetPostgresSettingsQuery({
    variables: { appId: project?.id },
  });

  const isPITREnabled = isNotEmptyValue(data?.config.postgres.pitr?.retention);

  return isPITREnabled;
}

export default useIsPITREnabled;
