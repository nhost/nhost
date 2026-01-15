import { useEffect, useMemo, useRef } from 'react';
import { isNotEmptyValue } from '@/lib/utils';
import { useGetPostgresSettingsLazyQuery } from '@/utils/__generated__/graphql';

function useIsPiTREnabledLazy(appId?: string) {
  const [getPostgresSettings, { data, loading }] =
    useGetPostgresSettingsLazyQuery({
      fetchPolicy: 'no-cache',
    });
  const prevAppId = useRef<string>();

  useEffect(() => {
    async function fetchPiTRSettings() {
      if (isNotEmptyValue(appId) && prevAppId.current !== appId) {
        await getPostgresSettings({ variables: { appId } });
        prevAppId.current = appId;
      }
    }
    fetchPiTRSettings();
  }, [appId, getPostgresSettings]);

  const isPiTREnabled = useMemo(
    () => isNotEmptyValue(data?.config?.postgres.pitr),
    [data?.config?.postgres.pitr],
  );

  return { isPiTREnabled, loading };
}

export default useIsPiTREnabledLazy;
