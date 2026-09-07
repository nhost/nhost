import { useEffect, useMemo, useState } from 'react';
import { useGetPostgresSettingsLazyQuery } from '@/generated/graphql';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';

function useIsPiTREnabledLazy(appId?: string) {
  const [getPostgresSettings, { data, loading }] =
    useGetPostgresSettingsLazyQuery({
      fetchPolicy: 'no-cache',
    });
  const [resolvedAppId, setResolvedAppId] = useState<string>();

  useEffect(() => {
    let isMounted = true;

    async function fetchPiTRSettings() {
      if (isEmptyValue(appId)) {
        setResolvedAppId(undefined);
        return;
      }

      setResolvedAppId(undefined);

      try {
        await getPostgresSettings({ variables: { appId } });
      } finally {
        if (isMounted) {
          setResolvedAppId(appId);
        }
      }
    }

    fetchPiTRSettings();

    return () => {
      isMounted = false;
    };
  }, [appId, getPostgresSettings]);

  const isPiTREnabled = useMemo(
    () => isNotEmptyValue(data?.config?.postgres.pitr),
    [data?.config?.postgres.pitr],
  );

  const isPiTRStatusLoading =
    isNotEmptyValue(appId) && (loading || resolvedAppId !== appId);

  return { isPiTREnabled, loading: isPiTRStatusLoading };
}

export default useIsPiTREnabledLazy;
