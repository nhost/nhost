import { useCallback, useState } from 'react';

import { useIsNotPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { RECOVERY_RETENTION_PERIOD_7 } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants/postgresqlConstants';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUpdateConfigMutation } from '@/utils/__generated__/graphql';

function useUpdateDatabasePITRConfig() {
  const isNotPlatform = useIsNotPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();
  const [loading, setLoading] = useState(false);

  const [updateConfig] = useUpdateConfigMutation({
    ...(isNotPlatform ? { client: localMimirClient } : {}),
  });

  const updatePITRConfig = useCallback(
    async (isPITREnabled: boolean) => {
      const retention = isPITREnabled ? RECOVERY_RETENTION_PERIOD_7 : null;

      const updateConfigMutationPromise = updateConfig({
        variables: {
          appId: project?.id,
          config: {
            postgres: {
              pitr: {
                retention,
              },
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
          loadingMessage: `${isPITREnabled ? 'Enabling' : 'Disabling'} Point-in-Time recovery...`,
          successMessage: `Point-in-Time has been ${isPITREnabled ? 'enabled' : 'disabled'} successfully.`,
          errorMessage:
            'An error occurred while trying to enable Point-in-Time recovery.',
          onError: () => setLoading(false),
        },
      );
    },
    [updateConfig, project?.id],
  );

  return { updatePITRConfig, loading };
}

export default useUpdateDatabasePITRConfig;
