import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/v3/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/v3/button';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useDeleteOrganizationMutation } from '@/utils/__generated__/graphql';
import { TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function DeleteOrg() {
  const router = useRouter();
  const { org } = useCurrentOrg();
  const [deleting, setDeleting] = useState(false);
  const [deleteOrgMutation] = useDeleteOrganizationMutation();

  const handleDeleteOrg = async () => {
    const { id } = org;

    setDeleting(true);
    await execPromiseWithErrorToast(
      async () => {
        await deleteOrgMutation({
          variables: {
            id,
          },
        });

        router.push('/');
      },
      {
        loadingMessage: 'Deleting the organization',
        successMessage: 'Successfully deleted the organization',
        errorMessage: 'An error occurred while deleting the organization!',
      },
    );
  };

  return (
    <div className="flex flex-col w-full border rounded-md bg-background">
      <div className="w-full p-4 font-medium border-b">Delete organization</div>

      <div className="w-full">
        <Alert severity="warning">
          <div className="flex flex-row items-center gap-2">
            <TriangleAlert className="w-4 h-4" strokeWidth={3} />
            <span className="font-bold">Warning</span>
          </div>
          <p className="text-left">
            Before deleting the organization, ensure that all associated
            projects are deleted first. Proceed with caution, as this action is
            irreversible and will permanently remove the organization.
          </p>
        </Alert>
      </div>

      <div className="flex justify-end gap-2 p-2 border-t">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={deleting}>
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                organization and all associated projects.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async (e) => {
                  e.preventDefault();
                  await handleDeleteOrg();
                }}
                className={buttonVariants({ variant: 'destructive' })}
                disabled={deleting}
              >
                {deleting ? <ActivityIndicator /> : 'Continue'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
