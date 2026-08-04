import { useRouter } from 'next/router';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import useNativeQueryMetadataMutation from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
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

  const handleDeleteDialogClick = async () => {
    if (!query) {
      return;
    }
    await execPromiseWithErrorToast(
      async () => {
        await deleteNativeQuery({ original: query });
        if (querySlug === query.root_field_name) {
          router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${dataSourceSlug}`,
          );
        }
      },
      {
        loadingMessage: 'Deleting native query...',
        successMessage: 'Native query deleted successfully.',
        errorMessage: 'An error occurred while deleting the native query.',
      },
    );
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-[425px]"
        hideCloseButton
        disableOutsideClick={isDeletingNativeQuery}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Delete Native Query
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the{' '}
            <span className="rounded-md bg-muted px-1 py-0.5 font-mono">
              {query?.root_field_name}
            </span>{' '}
            native query?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
          <ButtonWithLoading
            variant="destructive"
            className="!text-sm+ text-white"
            onClick={handleDeleteDialogClick}
            loading={isDeletingNativeQuery}
          >
            Delete
          </ButtonWithLoading>
          <DialogClose asChild>
            <Button variant="outline" className="!text-sm+ text-foreground">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
