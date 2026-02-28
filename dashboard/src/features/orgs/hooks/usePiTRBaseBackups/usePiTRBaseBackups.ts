import { useEffect, useState } from 'react';
import { isNotEmptyValue } from '@/lib/utils';
import { useGetPiTrBaseBackupsLazyQuery } from '@/utils/__generated__/graphql';
import { triggerToast } from '@/utils/toast';

function usePiTRBaseBackups(appId: string) {
  const [earliestBackupDate, setEarliestBackup] = useState<string>();
  const [fetchPiTRBaseBackups, { loading }] = useGetPiTrBaseBackupsLazyQuery();

  useEffect(() => {
    async function getPiTRBaseBackups() {
      if (appId) {
        const { data, error } = await fetchPiTRBaseBackups({
          variables: { appId },
        });
        if (error) {
          triggerToast(
            'An error occurred while fetching the Point-in-Time backup data. Please try again later.',
          );
        }
        if (isNotEmptyValue(data?.getPiTRBaseBackups)) {
          const earliestBackup = data.getPiTRBaseBackups.slice(-1).pop()!;
          setEarliestBackup(earliestBackup.date);
        }
      }
    }
    getPiTRBaseBackups();
  }, [appId, fetchPiTRBaseBackups]);

  return { earliestBackupDate, loading };
}

export default usePiTRBaseBackups;
