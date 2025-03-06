import { useCallback, useState } from 'react';

import { RECOVERY_RETENTION_PERIOD_7 } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants/postgresqlConstants';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUpdateConfigMutation } from '@/utils/__generated__/graphql';

function useUpdateDatabasePiTRConfig() {
  const { project } = useProject();
  const [loading, setLoading] = useState(false);

  const [updateConfig] = useUpdateConfigMutation();

  const updatePiTRConfig = useCallback(
    async (isPiTREnabled: boolean) => {
      const pitr = isPiTREnabled
        ? { retention: RECOVERY_RETENTION_PERIOD_7 }
        : null;

      const updateConfigMutationPromise = updateConfig({
        variables: {
          appId: project?.id,
          config: {
            postgres: {
              pitr,
            },
          },
        },
      });
      await execPromiseWithErrorToast(
        async () => {
          setLoading(true);
          await updateConfigMutationPromise;
          setLoading(false);
        },
        {
          loadingMessage: `${isPiTREnabled ? 'Enabling' : 'Disabling'} Point-in-Time recovery...`,
          successMessage: `Point-in-Time has been ${isPiTREnabled ? 'enabled' : 'disabled'} successfully.`,
          errorMessage:
            'An error occurred while trying to enable Point-in-Time recovery.',
          onError: () => setLoading(false),
        },
      );
    },
    [updateConfig, project?.id],
  );

  return { updatePiTRConfig, loading };
}

export default useUpdateDatabasePiTRConfig;
