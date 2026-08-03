import { useEffect, useRef } from 'react';
import { useGetPostgresSettingsLazyQuery } from '@/generated/graphql';
import { isNotEmptyValue } from '@/lib/utils';

function useIsPiTREnabledLazy(appId?: string) {
  const [getPostgresSettings, { data, loading }] =
    useGetPostgresSettingsLazyQuery({
      fetchPolicy: 'no-cache',
    });
  const prevAppId = useRef<string | undefined>(undefined);

  useEffect(() => {
    async function fetchPiTRSettings() {
      if (isNotEmptyValue(appId) && prevAppId.current !== appId) {
        await getPostgresSettings({ variables: { appId } });
        prevAppId.current = appId;
      }
    }
    fetchPiTRSettings();
  }, [appId, getPostgresSettings]);

  const isPiTREnabled = isNotEmptyValue(data?.config?.postgres.pitr);

  return { isPiTREnabled, loading };
}

export default useIsPiTREnabledLazy;
