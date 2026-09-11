import { useGetBackupPresignedUrlLazyQuery } from '@/generated/graphql';
import { triggerToast } from '@/utils/toast';

/**
 * Fetches a presigned download URL for a backup and opens it in a new tab.
 * Shared by the Backups table row and the "latest backup" download action
 * shown on the Overview page while a project is paused.
 */
export default function useDownloadBackup(appId: string, backupId: string) {
  const [fetchPresignedUrl, { loading }] = useGetBackupPresignedUrlLazyQuery({
    variables: {
      appId,
      backupId,
    },
  });

  async function downloadBackup() {
    const { data: presignedUrlData, error } = await fetchPresignedUrl();

    if (error) {
      triggerToast(
        'An error occurred while fetching the presigned URL. Please try again later.',
      );

      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    window.open(presignedUrlData?.getBackupPresignedUrl.url, '_blank');
  }

  return { downloadBackup, loading };
}
