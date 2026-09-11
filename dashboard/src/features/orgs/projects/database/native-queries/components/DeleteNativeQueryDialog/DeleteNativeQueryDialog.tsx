import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { DeleteMetadataObjectDialog } from '@/features/orgs/projects/database/native-queries/components/DeleteMetadataObjectDialog';
import { useGetNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import { useNativeQueryMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

interface DeleteNativeQueryDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  query: NativeQueryItem | null;
}

export default function DeleteNativeQueryDialog({
  open,
  setOpen,
  query,
}: DeleteNativeQueryDialogProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, dataSourceSlug, querySlug } = router.query;
  const source =
    typeof dataSourceSlug === 'string' ? dataSourceSlug : 'default';
  const { mutateAsync: deleteNativeQuery, isPending: isDeletingNativeQuery } =
    useNativeQueryMetadataMutation({ type: 'delete' });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const { data: nativeQueries = [] } = useGetNativeQueries(source);
  const dependents = nativeQueries.filter(
    (item) =>
      query &&
      item.root_field_name !== query.root_field_name &&
      [
        ...(item.object_relationships ?? []),
        ...(item.array_relationships ?? []),
      ].some(
        ({ using }) =>
          'remote_native_query' in using &&
          using.remote_native_query === query.root_field_name,
      ),
  );

  const handleConfirm = async (): Promise<boolean> => {
    if (!query) {
      return false;
    }
    const submissionPath = router.asPath;
    const result = await execPromiseWithErrorToast(
      async () => {
        await deleteNativeQuery({ source, original: query });
        if (!isMountedRef.current || router.asPath !== submissionPath) {
          return false;
        }
        if (querySlug === query.root_field_name) {
          await router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${encodeURIComponent(source)}`,
          );
        }
        return true;
      },
      {
        loadingMessage: 'Deleting native query...',
        successMessage: 'Native query deleted successfully.',
        errorMessage: 'An error occurred while deleting the native query.',
      },
    );
    return result === true;
  };

  return (
    <DeleteMetadataObjectDialog
      open={open}
      setOpen={setOpen}
      title="Delete Native Query"
      noun="native query"
      name={query?.root_field_name}
      isPending={isDeletingNativeQuery}
      onConfirm={handleConfirm}
      warning={
        dependents.length > 0 ? (
          <Alert variant="warning">
            <AlertDescription className="text-left">
              Other native queries in the currently loaded metadata still
              reference this query, so Hasura may reject deletion until they are
              updated:{' '}
              {dependents.map((item) => item.root_field_name).join(', ')}.
            </AlertDescription>
          </Alert>
        ) : null
      }
    />
  );
}
