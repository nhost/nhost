import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function useStorageMaintenance() {
  const appClient = useAppClient();
  const { project } = useProject();

  const adminSecret = project?.config?.hasura.adminSecret;
  const headers = { 'x-hasura-admin-secret': adminSecret ?? '' };

  const {
    data: orphansData,
    isLoading: orphansLoading,
    refetch: refetchOrphans,
  } = useQuery({
    queryKey: ['storage-orphans', project?.id],
    queryFn: () => appClient.storage.listOrphanedFiles({ headers }),
    enabled: !!adminSecret,
  });

  const {
    data: brokenData,
    isLoading: brokenLoading,
    refetch: refetchBroken,
  } = useQuery({
    queryKey: ['storage-broken-metadata', project?.id],
    queryFn: () => appClient.storage.listBrokenMetadata({ headers }),
    enabled: !!adminSecret,
  });

  const refetch = useCallback(async () => {
    await Promise.all([refetchOrphans(), refetchBroken()]);
  }, [refetchOrphans, refetchBroken]);

  const deleteOrphans = () =>
    appClient.storage.deleteOrphanedFiles({ headers });

  const deleteBroken = () =>
    appClient.storage.deleteBrokenMetadata({ headers });

  return {
    orphanCount: orphansData?.body.files?.length ?? 0,
    brokenMetadataCount: brokenData?.body.metadata?.length ?? 0,
    isLoading: orphansLoading || brokenLoading,
    refetch,
    deleteOrphans,
    deleteBroken,
  };
}
