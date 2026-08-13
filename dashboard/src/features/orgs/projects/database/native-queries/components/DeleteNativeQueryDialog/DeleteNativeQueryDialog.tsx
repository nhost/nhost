import { useRouter } from 'next/router';
import { DeleteMetadataObjectDialog } from '@/features/orgs/projects/database/native-queries/components/DeleteMetadataObjectDialog';
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
  const { mutateAsync: deleteNativeQuery, isPending: isDeletingNativeQuery } =
    useNativeQueryMetadataMutation({ type: 'delete' });

  const handleConfirm = async (): Promise<boolean> => {
    if (!query) {
      return false;
    }
    const result = await execPromiseWithErrorToast(
      async () => {
        await deleteNativeQuery({ original: query });
        if (querySlug === query.root_field_name) {
          await router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${dataSourceSlug}`,
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
    />
  );
}
