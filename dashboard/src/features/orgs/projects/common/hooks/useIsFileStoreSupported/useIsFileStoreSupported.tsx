import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetConfiguredVersionsQuery } from '@/utils/__generated__/graphql';
import { useEffect, useState } from 'react';

function compareSemver(v1: string, v2: string): number {
  const parse = (v: string) => v.split('.').map(Number);
  const [a, b] = [parse(v1), parse(v2)];
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) {
      return 1;
    }
    if (a[i] < b[i]) {
      return -1;
    }
  }
  return 0;
}

const MIN_VERSION_WITH_FILE_STORE_SUPPORT = '0.6.2';

export default function useIsFileStoreSupported() {
  const [isFileStoreSupported, setIsFileStoreSupported] = useState<
    boolean | null
  >(null);
  const { project } = useProject();
  const localMimirClient = useLocalMimirClient();
  const isPlatform = useIsPlatform();

  const { data, loading, error } = useGetConfiguredVersionsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  useEffect(() => {
    if (!loading && data?.config?.ai?.version) {
      setIsFileStoreSupported(
        compareSemver(
          data.config.ai.version,
          MIN_VERSION_WITH_FILE_STORE_SUPPORT,
        ) >= 0,
      );
    }
  }, [data, loading]);

  return {
    isFileStoreSupported,
    version: data?.config?.ai?.version,
    loading,
    error,
  };
}
