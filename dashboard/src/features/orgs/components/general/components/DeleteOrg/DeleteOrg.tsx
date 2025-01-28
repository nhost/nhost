import { useUI } from '@/components/common/UIProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
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
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Separator } from '@/components/ui/v3/separator';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useDeleteOrganizationMutation } from '@/utils/__generated__/graphql';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function DeleteOrg() {
  const { maintenanceActive } = useUI();
  const router = useRouter();
  const { org } = useCurrentOrg();
  const { refetch: refetchOrgs } = useOrgs();
  const [deleting, setDeleting] = useState(false);
  const [deleteCheck1, setDeleteCheck1] = useState(false);
  const [deleteCheck2, setDeleteCheck2] = useState(false);
  const [deleteOrgMutation] = useDeleteOrganizationMutation();

  const handleDeleteOrg = async () => {
    setDeleting(true);

    await execPromiseWithErrorToast(
      async () => {
        await deleteOrgMutation({
          variables: {
            id: org?.id,
          },
          onCompleted: async () => {
            await refetchOrgs();
            setDeleting(false);
            await router.push('/');
          },
        });
      },
      {
        loadingMessage: 'Deleting the organization',
        successMessage: 'Successfully deleted the organization',
        errorMessage: 'An error occurred while deleting the organization!',
      },
    );
  };

  return (
    <div className="flex w-full flex-col rounded-md border border-destructive bg-background">
      <div className="flex w-full flex-col gap-2 border-b p-4 font-medium">
        <h3>Delete Organization</h3>
        <p className="text-sm font-normal text-muted-foreground">
          Proceed with caution, as this action is irreversible and will
          permanently remove the organization.
        </p>
      </div>

      <div className="flex justify-end gap-2 p-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={deleting || org?.plan?.isFree || maintenanceActive}
            >
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="flex w-full max-w-sm flex-col gap-6 p-6 text-left text-foreground">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Organization</AlertDialogTitle>
              <AlertDialogDescription className="flex flex-col gap-1">
                Are you sure you want to delete this Organization?
                <span className="font-bold text-red-500">
                  This cannot be undone.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-col gap-2">
              <Separator />
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delete-check1"
                  checked={deleteCheck1}
                  onCheckedChange={(checked) =>
                    setDeleteCheck1(Boolean(checked))
                  }
                />
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label
                  htmlFor="delete-check1"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I&apos;m sure I want to delete this Organization
                </label>
              </div>
              <Separator />
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delete-check2"
                  checked={deleteCheck2}
                  onCheckedChange={(checked) =>
                    setDeleteCheck2(Boolean(checked))
                  }
                />
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label
                  htmlFor="delete-check2"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I understand this action cannot be undone
                </label>
              </div>
              <Separator />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async (e) => {
                  e.preventDefault();
                  await handleDeleteOrg();
                }}
                className={buttonVariants({ variant: 'destructive' })}
                disabled={
                  deleting ||
                  !(deleteCheck1 && deleteCheck2) ||
                  maintenanceActive
                }
              >
                {deleting ? <ActivityIndicator /> : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
