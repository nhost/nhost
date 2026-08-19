import { useState } from 'react';
import {
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/v3/alert-dialog';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useDeleteUserAccountMutation } from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { useAuth } from '@/providers/Auth';
import {
  errorMessageIncludes,
  getViolatedConstraint,
} from '@/utils/databaseErrors';

export default function DeleteAccount() {
  const { signout } = useAuth();
  const userData = useUserData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [remove, setRemove] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);

  const [deleteUserAccount] = useDeleteUserAccountMutation({
    variables: { id: userData?.id },
  });

  const onClickConfirm = async () => {
    setLoadingRemove(true);

    await execPromiseWithErrorToast(
      async () => {
        await deleteUserAccount();
        await signout();
        setDialogOpen(false);
      },
      {
        loadingMessage: 'Deleting your account...',
        successMessage: 'The account has been deleted successfully.',
        errorMessage: (error) => {
          if (getViolatedConstraint(error) === 'apps_creator_user_id_fkey') {
            return 'Your account still owns projects. Delete them before deleting your account.';
          }

          if (errorMessageIncludes(error, 'Cannot delete the last admin')) {
            return 'You are the only admin of an organization. Promote another member to admin or delete the organization before deleting your account.';
          }

          return 'An error occurred while deleting your account. Please try again.';
        },
      },
    );

    setLoadingRemove(false);
  };

  return (
    <AccountSettingsCard>
      <SettingsCardHeader
        title="Delete Account"
        description="Please proceed with caution as the removal of your Personal Account and its contents from the Nhost platform is irreversible. This action will permanently delete your account and all associated data."
      />

      <SettingsCardFooter>
        <AlertDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setRemove(false);
            }
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full sm:w-auto">
              Delete Personal Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="z-[9999] max-w-sm text-foreground">
            <AlertDialogHeader className="text-left">
              <AlertDialogTitle className="text-2xl">
                Delete Account?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action is permanent and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="my-2 flex items-center gap-2">
              <Checkbox
                id="confirm-delete-account"
                checked={remove}
                onCheckedChange={(checked) => setRemove(checked === true)}
                aria-label="Confirm Delete Account"
              />
              <Label
                htmlFor="confirm-delete-account"
                className="cursor-pointer font-normal text-foreground"
              >
                I&apos;m sure I want to delete my account
              </Label>
            </div>

            <div className="grid grid-flow-row gap-2">
              <ButtonWithLoading
                type="button"
                variant="destructive"
                onClick={onClickConfirm}
                disabled={!remove}
                loading={loadingRemove}
                className="w-full"
              >
                Delete
              </ButtonWithLoading>

              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={loadingRemove}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </SettingsCardFooter>
    </AccountSettingsCard>
  );
}
