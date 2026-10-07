import { useRouter } from 'next/router';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { DeleteMetadataObjectDialog } from '@/features/orgs/projects/database/common/components/DeleteMetadataObjectDialog';
import { useGetNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import { useNativeQueryMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

function getNativeQueryDependents(
  nativeQueries: NativeQueryItem[],
  targetName: string,
): NativeQueryItem[] {
  return nativeQueries.filter((nativeQuery) => {
    if (nativeQuery.root_field_name === targetName) {
      return false;
    }

    const relationships = [
      ...(nativeQuery.object_relationships ?? []),
      ...(nativeQuery.array_relationships ?? []),
    ];

    return relationships.some(
      ({ using }) =>
        'remote_native_query' in using &&
        using.remote_native_query === targetName,
    );
  });
}

interface DeleteNativeQueryDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  query: NativeQueryItem;
}

export default function DeleteNativeQueryDialog({
  open,
  setOpen,
  query,
}: DeleteNativeQueryDialogProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, querySlug } = router.query;
  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const { mutateAsync: deleteNativeQuery, isPending: isDeletingNativeQuery } =
    useNativeQueryMetadataMutation({ type: 'delete' });
  const { data: nativeQueries = [] } = useGetNativeQueries();
  const dependents = getNativeQueryDependents(
    nativeQueries,
    query.root_field_name,
  );

  async function handleConfirm(): Promise<boolean> {
    const result = await execPromiseWithErrorToast(
      async () => {
        await deleteNativeQuery({
          resourceVersion: resourceVersion!,
          original: query,
        });
        if (querySlug === query.root_field_name) {
          await router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/default`,
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
  }

  return (
    <DeleteMetadataObjectDialog
      open={open}
      setOpen={setOpen}
      title="Delete Native Query"
      noun="native query"
      name={query.root_field_name}
      isPending={isDeletingNativeQuery}
      onConfirm={handleConfirm}
      warning={
        dependents.length > 0 ? (
          <Alert variant="warning">
            <AlertDescription className="text-left">
              Other native queries in the currently loaded metadata still
              reference this query, so the deletion may be rejected until they
              are updated:{' '}
              {dependents.map((item) => item.root_field_name).join(', ')}.
            </AlertDescription>
          </Alert>
        ) : null
      }
    />
  );
}
